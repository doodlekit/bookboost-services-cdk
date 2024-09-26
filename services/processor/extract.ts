import Anthropic from '@anthropic-ai/sdk'
import {
  GoogleGenerativeAI,
  SchemaType,
  ModelParams,
  HarmBlockThreshold,
  HarmCategory
} from '@google/generative-ai'
import OpenAI from 'openai'
import { GoogleAIFileManager, Part, UploadFileResponse } from '@google/generative-ai/server'
import { getS3Content, downloadFileFromUrl } from './s3'
import { fuzzy } from 'fast-fuzzy'

// Constants
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || ''
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const SYSTEM_PROMPT = `You are a JavaScript programmer tasked with creating a function to extract chapters from a book manuscript.`

// Initialize clients
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY)
const openai = new OpenAI({ apiKey: OPENAI_API_KEY })

// Utility functions
function convertToAscii(text: string): string {
  return text
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x00-\x7F]/g, (char) => {
      try {
        return char.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      } catch {
        return char
      }
    })
}

function stripNonAscii(text: string): string {
  return text.replace(/[^\w\s]/g, '')
}

function formatTitle(title: string): string {
  return stripNonAscii(
    title
      .toLowerCase()
      .replace(/[\n\r\s]*/g, '')
      .replace(/<[^>]*>?/g, '')
      .trim()
  )
}

function titleInLine(line: string, title: string): boolean {
  if (formatTitle(line).startsWith(formatTitle(title))) {
    return true
  }
  return false
}

function removeStars(title: string): string {
  return title.replace(/\*/g, '')
}

function compareTitles(title1: string, title2: string, weakMatch: boolean = true) {
  const title1NoStars = removeStars(title1).trim()
  const title2NoStars = removeStars(title2).trim()
  if (!title1NoStars || !title2NoStars) {
    return false
  }
  const format1 = formatTitle(title1NoStars)
  const format2 = formatTitle(title2NoStars)
  if (format1.length < 5 || format2.length < 5) {
    return false
  }
  if (format1.startsWith(format2) || format2.startsWith(format1)) {
    return true
  }
  if (!weakMatch) {
    return false
  }
  const similarity = fuzzy(title1NoStars, title2NoStars, {
    ignoreCase: true,
    ignoreWhitespace: true,
    returnMatchData: true
  })
  let match = false
  const indexZeroMatch =
    similarity.score > 0.7 &&
    similarity.match.index === 0 &&
    similarity.match.length > title2NoStars.length * 0.75
  const offsetMatch =
    similarity.score > 0.8 &&
    similarity.match.index < 4 &&
    similarity.match.length > title2NoStars.length * 0.5
  match = indexZeroMatch || offsetMatch
  return match
}

function analyzeChapterTitles(manuscript: string, chapterTitles: string[]) {
  const lines = manuscript.split('\n')
  const tocPattern = /^\s*(Table of Contents|Contents|Chapters)\s*$/i
  const tocLine = lines.find((line) => tocPattern.test(line))
  const tocLineIndex = tocLine ? lines.indexOf(tocLine) : 0

  let firstChapterInText = false
  const firstChapter = chapterTitles[0]
  if (tocLine) {
    const linesInTox = lines.slice(tocLineIndex, tocLineIndex + chapterTitles.length)
    for (const line of linesInTox) {
      if (compareTitles(line, firstChapter)) {
        firstChapterInText = true
        break
      }
    }
  }

  let lastChapterInToc = false
  const lastChapter = chapterTitles[chapterTitles.length - 1]
  if (tocLine) {
    const linesInTox = lines.slice(tocLineIndex, tocLineIndex + chapterTitles.length + 5)
    for (const line of linesInTox) {
      if (compareTitles(line, lastChapter)) {
        lastChapterInToc = true
        break
      }
    }
  }

  let strongTitleMatch = 0
  const strongTitleMatchLimit = chapterTitles.length * 0.8
  const contentLines = lines.slice(tocLineIndex + chapterTitles.length)
  for (const line of contentLines) {
    if (chapterTitles.find((title) => compareTitles(line, title, false))) {
      strongTitleMatch++
      if (strongTitleMatch > strongTitleMatchLimit) {
        break
      }
    }
  }

  return {
    tocLine,
    firstChapterInText,
    lastChapterInToc,
    strongTitleMatch: strongTitleMatch > strongTitleMatchLimit
  }
}

function endOfToc(line: string, chapterTitles: string[], stats: any, tocCount: number) {
  if (stats.lastChapterInToc) {
    const lastChapterTitle = chapterTitles[chapterTitles.length - 1]
    return { result: compareTitles(line, lastChapterTitle), skipLine: true }
  }
  if (stats.firstChapterInText && tocCount > chapterTitles.length / 2) {
    const firstChapterTitle = chapterTitles[0]
    return { result: compareTitles(line, firstChapterTitle), skipLine: false }
  }
  return { result: false, skipLine: false }
}

async function removeToc(manuscript: string, chapterTitles: string[], stats: any) {
  const tocPattern = /^\s*(Table of Contents|Contents|Chapters)\s*$/i
  const lines = manuscript.split('\n')
  const tocLine = lines.find((line) => tocPattern.test(line))
  if (!tocLine) {
    return manuscript
  }

  let truncatedManuscript = ''
  let pastToc = false
  let inToc = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (tocPattern.test(line) || inToc) {
      inToc++
    }
    if (!pastToc) {
      const tocCheck = endOfToc(line, chapterTitles, stats, inToc)
      if (tocCheck.result) {
        pastToc = true
        inToc = 0
        if (tocCheck.skipLine) {
          continue
        }
      }
    }
    if (pastToc) {
      truncatedManuscript += lines[i] + '\n'
    }
  }
  return truncatedManuscript
}

// New functions for Anthropic and Gemini API calls
async function callAnthropic(prompt: string, maxTokens: number = 4000, temperature: number = 1) {
  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20240620',
    max_tokens: maxTokens,
    temperature: temperature,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }]
  })
  return (response.content[0] as any).text
}

async function callGemini(
  prompt: string,
  temperature: number = 0.5,
  schema?: any,
  file?: UploadFileResponse
) {
  const modelConfig: ModelParams = {
    model: 'gemini-1.5-pro',
    generationConfig: {
      temperature: temperature
    },
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE
      }
    ]
  }

  if (schema && modelConfig.generationConfig) {
    modelConfig.generationConfig.responseMimeType = 'application/json'
    modelConfig.generationConfig.responseSchema = schema
  }

  const model = genAI.getGenerativeModel(modelConfig)

  let promptParams: Array<Part> = [
    {
      text: prompt
    }
  ]
  if (file) {
    promptParams.push({
      fileData: {
        mimeType: file.file.mimeType,
        fileUri: file.file.uri
      }
    })
  }
  const result = await model.generateContent(promptParams)

  return schema ? JSON.parse(result.response.text()) : result.response.text()
}

async function callOpenAI(prompt: string) {
  const response = await openai.chat.completions.create({
    // model: 'o1-mini',
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }]
  })
  const text = response.choices[0].message.content
  if (text && text.startsWith('```json')) {
    const jsonBody = text.replace('```json', '').replace('```', '').trim()
    return JSON.parse(jsonBody)
  }
  return text
}

export async function getChapterTitles(fileContent: string) {
  const schema = {
    type: SchemaType.ARRAY,
    items: {
      type: SchemaType.STRING
    }
  }
  const prompt = `
  <manuscript>
  ${fileContent}
  </manuscript>
  Task: Extract the FULL table of contents from the given manuscript.

Output format: Provide a JSON array of strings, where each string contains a chapter title.

Important guidelines:
* Use the COMPLETE title as it appears in the manuscript. Do not truncate or modify them in any way.
* Do not add or remove chapter numbers if they're part of the original title.
* Include sections like Prologue, Epilogue, etc.

Exclusions:
* Subtitles, exhibit titles, and other minor section titles.
* Book title, author name, or copyright information.
`

  const chapterTitles = await callGemini(prompt, 0, schema)
  const postProcessedChapterTitles = await postProcessChapterTitles(chapterTitles)
  console.log('----------------------------------------')
  console.log(postProcessedChapterTitles)
  console.log('----------------------------------------')

  return { chapterTitles: postProcessedChapterTitles, prompt }
}

async function postProcessChapterTitles(chapterTitles: any[]) {
  console.log('----------------------------------------')
  console.log(chapterTitles)
  console.log('----------------------------------------')

  let titles = chapterTitles

  // Remove empty strings
  titles = titles.filter((title) => title.trim() !== '')

  // Replace multiple newlines with a single newline
  titles = titles.map((title) => title.replace(/[\r\n\s\t]+/g, ' '))

  // Remove "Table of Contents"
  titles = titles.filter((title) => title.toLowerCase().trim() !== 'table of contents')

  // Remove numbers from the beginning of the title
  titles = titles.map((title) => title.replace(/^[0-9]+[\.\:]*\s*/g, ''))

  // Trim leading and trailing whitespace
  titles = titles.map((title) => title.trim())

  return titles
}

export async function extractChapters(manuscript: string, chapterTitles: string[]) {
  const chapters = []

  const stats = analyzeChapterTitles(manuscript, chapterTitles)
  console.log('stats', stats)

  let currentChapter: { title: string; content: string } | null = null
  let truncatedManuscript = await removeToc(manuscript, chapterTitles, stats)

  const lines = truncatedManuscript.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line === '') {
      continue
    }

    // Check if the line matches any chapter title
    let matchingTitle = chapterTitles.find((title) =>
      compareTitles(line, title, !stats.strongTitleMatch)
    )

    // Don't move to the next chapter if the title is the same as the current chapter
    const isCurrentTitle = matchingTitle && currentChapter && matchingTitle === currentChapter.title

    if (matchingTitle && !isCurrentTitle) {
      const isTitleInLine = titleInLine(line, matchingTitle)
      // If we find a matching title, start a new chapter
      if (currentChapter) {
        chapters.push(currentChapter)
      }
      currentChapter = {
        title: matchingTitle,
        content: isTitleInLine ? line.replace(matchingTitle, '') : ''
      }
    } else if (currentChapter) {
      // If we are within a chapter, add the line to the content
      currentChapter.content += line + '\n'
    }
  }

  // Push the last chapter
  if (currentChapter) {
    chapters.push(currentChapter)
  }

  return postProcessChapters(chapters)
}

async function postProcessChapters(chapters: any[]) {
  let filteredChapters = chapters
  // Remove empty chapters
  filteredChapters = filteredChapters.filter((chapter) => chapter.content.trim() !== '')

  // Trim leading and trailing whitespace
  filteredChapters = filteredChapters.map((chapter) => {
    chapter.content = chapter.content.trim()
    return chapter
  })

  return filteredChapters
}

export async function postProcessChapter(chapter: any) {
  const schema = {
    type: SchemaType.OBJECT,
    properties: {
      title: { type: SchemaType.STRING },
      content: { type: SchemaType.STRING },
      flag: { type: SchemaType.BOOLEAN }
    },
    required: ['title', 'content', 'flag']
  }

  // console.log(chapter)
  const prompt = `
    The following is a chapter from a book manuscript. 
    Your job is to evaluate the content, make sure it looks correct, and return the modified chapter.
    Output should be a JSON object with a "content" property.

    \`\`\`chapter
    ${chapter.content}
    \`\`\`

    Tasks:
    1. Fix any text encoding issues.
    2. Fix issues from PDF to TXT conversion, like broken words.
    3. Format the content for text-to-speech: Each paragraph should have only 2-3 sentences.
    4. Paragraphs should be separated by double newlines.
    5. Ensure that the "content" property is always included, even if it's empty.
    `

  try {
    const processedChapter = await callOpenAI(prompt)
    console.log('----------------------------------------')
    console.log(processedChapter)
    console.log('----------------------------------------')

    return {
      ...chapter,
      content: processedChapter.content,
      processed: true,
      flag: false
    }
  } catch (error: any) {
    console.error(`Error processing chapter: ${chapter.title}`, error)
    chapter.processed = true
    chapter.error = error.message
    return chapter
  }
}

export async function evaluateExtraction(extractedChapters: any[], manuscript: string) {
  const schema = {
    type: SchemaType.OBJECT,
    properties: {
      score: { type: SchemaType.NUMBER },
      summary: { type: SchemaType.STRING }
    },
    required: ['score', 'summary']
  }
  const filteredChapters = extractedChapters

  const prompt = `
  <input>
  Original manuscript:
  ${manuscript}
  </input>
  <output>
  List of extracted chapters:
  ${JSON.stringify(
    filteredChapters.map((ch) => ({ title: ch.title, contentLength: ch.content.length })),
    null,
    2
  )}
  </output>

  You are an expert in evaluating text extraction algorithms. Your task is to assess the quality of chapter extraction from a book manuscript.

  Please evaluate the extraction based on the following criteria:
  0. Completeness: Does the extraction include all the chapters in the original manuscript?
  1. Accuracy: Do the chapter titles match those in the original manuscript?
  2. Content integrity: Does the content of each chapter seem to be correctly extracted?
  3. Overall quality: On a scale of 1-10, how would you rate the extraction?

  Do not penalize for duplicate chapter titles or the titles being out of order.

  The output should be a JSON object with a "score" property (1-10) and a "summary" property.
  `

  try {
    const result = await callGemini(prompt, 0, schema)
    return result
  } catch (error) {
    console.error('Error evaluating extraction:', error)
    throw error
  }
}

export async function processManuscript(manuscript: string) {
  const { chapterTitles, prompt } = await getChapterTitles(manuscript)
  const chapters = await extractChapters(manuscript, chapterTitles)
  return { chapters, prompt }
}

export async function processManuscriptFromS3(key: string) {
  const fileContent = await getS3Content(key)
  if (!fileContent) {
    throw new Error('File content is undefined')
  }
  return await processManuscript(fileContent)
}
