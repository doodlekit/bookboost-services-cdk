import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
import { getS3Content } from './s3'

// Constants
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || ''
const SYSTEM_PROMPT = `You are a JavaScript programmer tasked with creating a function to extract chapters from a book manuscript.`

// Initialize clients
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY)

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
  return schema ? JSON.parse(result.response.text()) : result.response.text()
}

// Core processing functions
async function preprocessManuscript(fileContent: string) {
  // Check if the preprocessed file already exists
  // const outputPath = 'preprocessed_structure.txt'
  // try {
  //   const existingContent = await fs.readFile(outputPath, 'utf-8')
  //   console.log(`Preprocessed structure already exists. Loading from ${outputPath}`)
  //   return existingContent
  // } catch (error) {
  //   // File doesn't exist, continue with preprocessing
  //   console.log(`Preprocessed structure not found. Generating new structure.`)
  // }
  const preprocessPrompt = `
<document>
${fileContent}
</document>

Analyze the attached manuscript content and provide a summary of its structure.
This summary will be used to create a Javascript function that extracts chapters from the manuscript.

Include the following:
- FULL list of chapter titles, sections, and any other relevant structural elements.
- Use the full chapter titles, do not truncate them or remove the chapter numbers.
- Whether there are any chapter titles that could easily be found in the contents of a chapter.
- Whether there are chapter titles in the body that have leading spaces.

Other considerations:
- Do not add numbers at the beginning of the chapter titles.
- Do not alter the chapter titles in any way.
`

  // console.log('----------------------------------------')
  // console.log(preprocessPrompt)
  // console.log('----------------------------------------')
  const text = await callGemini(preprocessPrompt, 0.3)
  console.log('----------------------------------------')
  console.log(text)
  console.log('----------------------------------------')
  // Write the preprocessed text to a file
  // await fs.writeFile(outputPath, text, 'utf-8')
  // console.log(`Preprocessed structure written to ${outputPath}`)
  return { prompt: preprocessPrompt, text: text }
}

async function extractChapters(
  fileContent: string,
  summary: string,
  useGemini: boolean = false,
  geminiModel: string = 'gemini-1.5-pro'
) {
  // Check if the cached chapters already exist
  // const outputPath = 'cached_extracted_chapters.json'
  // try {
  //   const existingContent = await fs.readFile(outputPath, 'utf-8')
  //   console.log(`Cached extracted chapters exist. Loading from ${outputPath}`)
  //   return JSON.parse(existingContent)
  // } catch (error) {
  //   // File doesn't exist, continue with generating and executing the function
  //   console.log(`Cached extracted chapters not found. Generating new chapters.`)
  // }

  const schema = {
    type: SchemaType.OBJECT,
    properties: {
      script: { type: SchemaType.STRING }
    },
    required: ['script']
  }
  const userPrompt = `
<structure_summary>
\`\`\`
${summary}
\`\`\`
</structure_summary>
Write a Javascript function named extractChapters that takes a string parameter (the manuscript content) and returns an array of chapter objects.

Output ONLY a JSON object with a "script" property that contains the function definition, with no additional text or explanations. The function should start with "function extractChapters(manuscript) {" and end with "}".

Use the structure summary provided above to inform your chapter extraction logic.

The function should:
- Detect chapter titles based on the list from the structure summary.
- Handle variations in chapter title formatting (e.g., "Chapter 1", "CHAPTER ONE", "1. Introduction").
- Ignore any content from the table of contents or front matter.

Each chapter object should have two properties:
1. title: The full chapter or section title (string)
2. content: The chapter content, excluding the title (string)

Important considerations:
- Ensure that all strings in the function are properly escaped, especially single and double quotes.
- Do not use regular expressions.
- Do NOT include chapter titles in the 'content' property.
- Consider that chapter titles may be in the middle of the content.
`
  // console.log('----------------------------------------')
  // console.log(userPrompt)
  // console.log('----------------------------------------')
  // const model = 'tunedModels/generate-num-1113'
  const model = 'gemini-1.5-pro'
  const output = await callGemini(userPrompt, 1, schema, model)
  const script = output.script
  // console.log(text)

  console.log('----------------------------------------')
  console.log(script)
  console.log('----------------------------------------')

  // Evaluate the script to get the extractChapters function
  // @ts-ignore
  // @esbuild-disable-next-line direct-eval
  const extractChapters = eval(`(${script})`)

  // Execute the extractChapters function
  const chapters = extractChapters(fileContent)

  // Remove any chapters that are empty
  const filteredChapters = chapters.filter(
    (chapter: any) => chapter.content.length > chapter.title.length
  )

  // Trim whitespace from the beginning and end of each chapter
  const trimmedChapters = filteredChapters.map((chapter: any) => {
    chapter.title = chapter.title.trim()
    chapter.content = chapter.content.trim()
    return chapter
  })

  return { chapters: trimmedChapters, script, prompt: userPrompt }
}

async function postProcessChapter(chapter: any) {
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
    The following JSON object is a chapter from a book manuscript. 
    Your job is to evaluate the content, make sure it looks correct, and return a new JSON object with the same structure.

    \`\`\`json
    ${JSON.stringify(chapter)}
    \`\`\`

    Output is a JSON object that MUST contain "title", "content", and "flag" properties.

    Tasks:
    1. If there is no or very little content, set the "flag" to true.
    2. If the content is a duplicate of the title, set the "flag" to true.
    3. If the content only includes other titles, set the "flag" to true.
    4. Fix any text encoding issues.
    5. Fix issues from PDF to TXT conversion, like broken words.
    6. Format the content for text-to-speech: Each paragraph should have only 2-3 sentences.
    7. Paragraphs should be separated by double newlines.
    8. Remove trailing and leading spaces in each paragraph.
    9. Ensure that the "content" property is always included, even if it's empty.
    10. Ensure that the contents are escaped properly so that it can be parsed as valid JSON.
    `

  try {
    const processedChapter = await callGemini(prompt, 0.5, schema)

    // console.log(processedChapter)
    processedChapter.processed = true
    return processedChapter
  } catch (error: any) {
    console.error(`Error processing chapter: ${chapter.title}`, error)
    chapter.processed = true
    chapter.error = error.message
    return chapter
  }
}

// New function to evaluate extraction
async function evaluateExtraction(extractedChapters: any[], manuscript: string) {
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
    console.log('----------------------------------------')
    console.log(result)
    console.log('----------------------------------------')
    return result
  } catch (error) {
    console.error('Error evaluating extraction:', error)
    throw error
  }
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

// Update the main processing function
async function processManuscript(
  fileContent: string,
  useGemini: boolean = false,
  geminiModel: string = 'gemini-1.5-pro'
) {
  try {
    fileContent = convertToAscii(fileContent)

    const { prompt: summaryPrompt, text: summary } = await preprocessManuscript(fileContent)
    const {
      prompt: chaptersPrompt,
      chapters,
      script
    } = await extractChapters(fileContent, summary, useGemini, geminiModel)

    return { chapters, summary, script, summaryPrompt, chaptersPrompt }
  } catch (error) {
    console.error('Error:', error)
    throw error
  }
}

async function processManuscriptFromS3(key: string) {
  const fileContent = await getS3Content(key)
  if (!fileContent) {
    throw new Error('File content is undefined')
  }
  return await processManuscript(fileContent)
}

// Export the main function for use in other modules
export { processManuscriptFromS3, processManuscript, postProcessChapter, evaluateExtraction }
