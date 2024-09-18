import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'

// Constants
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || ''
const SYSTEM_PROMPT = `You are a JavaScript programmer tasked with creating a function to extract chapters from a book manuscript.`

// Initialize clients
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY)

// New functions for Anthropic and Gemini API calls
async function callAnthropic(prompt: string, maxTokens: number = 2000, temperature: number = 1) {
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
  geminiModel: string = 'gemini-1.5-pro'
) {
  const modelConfig: any = {
    model: geminiModel,
    generationConfig: {
      temperature: temperature
    }
  }

  if (schema) {
    modelConfig.generationConfig.responseMimeType = 'application/json'
    modelConfig.generationConfig.responseSchema = schema
  }

  const model = genAI.getGenerativeModel(modelConfig)
  const result = await model.generateContent(prompt)
  console.log('callGemini result', '****', result.response.text(), '****')
  return schema ? JSON.parse(result.response.text()) : result.response.text()
}

async function getChapterTitles(manuscript: string) {
  const schema = {
    type: 'array',
    items: {
      type: 'string'
    }
  }
  const prompt = `
  <manuscript>
  ${manuscript}
  </manuscript>
  Extract the chapter titles from the attached book manuscript.
  Include the full chapter title as it appears in the table of contents.
  Return as a JSON array.
  `

  const result = await callGemini(prompt, 0.5, schema)
  return result
}

async function removeToc(manuscript: string) {
  const truncatedManuscript = manuscript.slice(0, 10000)
  console.log('truncatedManuscript', '****', truncatedManuscript, '****')
  const schema = {
    type: 'string'
  }
  const prompt = `
  <manuscript>
  ${truncatedManuscript}
  </manuscript>
  Remove the table of contents from the attached book manuscript.
  Return the remaining content.
  Output as a JSON string.
  `
  const result = await callGemini(prompt, 0.5, schema)
  // re-assemble the result with the rest of the manuscript
  console.log('-------')
  console.log('result', '****', result, '****')
  console.log('-------')
  const resultWithRestOfManuscript = `${result}\n${manuscript.slice(10000)}`
  return resultWithRestOfManuscript
}

async function markupChapters(manuscript: string) {
  const chapterTitles = await getChapterTitles(manuscript)
  const manuscriptWithoutToc = await removeToc(manuscript)

  const lines = manuscriptWithoutToc.split('\n')
  const chunkSize = 2000 // Adjust this based on Gemini's token limit
  const chunks = []
  let currentChunk = ''

  for (const line of lines) {
    if (currentChunk.length + line.length + 1 > chunkSize) {
      chunks.push(currentChunk)
      currentChunk = ''
    }
    currentChunk += (currentChunk ? '\n' : '') + line
  }
  if (currentChunk) {
    chunks.push(currentChunk)
  }

  const schema = {
    type: 'string'
  }

  let markedUpManuscript = ''

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]

    const prompt = `
    <manuscript_chunk>
    ${chunk}
    </manuscript_chunk>
    <chapter_titles>
    ${JSON.stringify(chapterTitles)}
    </chapter_titles>

    Identify chapters titles in the manuscript chunk using the provided list of chapter titles.
    Only return the marked-up chunk, with no other text.

    Add markup to denote the chapter title:

    [title]Chapter Title[/title]

    Only markup the titles if appears to be the start of a chapter, not if it's just a title in the middle of a paragraph.
    `
    console.log('-------')
    console.log(prompt)
    console.log('-------')

    const result = await callGemini(prompt, 0.5)
    console.log('-------')
    console.log(result)
    console.log('-------')
    markedUpManuscript += result
  }

  return markedUpManuscript
}

export { markupChapters }
