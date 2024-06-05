import OpenAI from 'openai'
import * as fs from 'fs'
import fetch from 'node-fetch'
const openai = new OpenAI()

const downloadFile = (url: string) => {
  console.log('Downloading file:', url)
  const filename = '/tmp/' + url.split('/').pop()
  return new Promise((resolve, reject) => {
    fetch(url).then(function (res) {
      if (!res.body) {
        reject('No body')
        return
      }
      var fileStream = fs.createWriteStream(filename)
      res.body.on('error', reject)
      fileStream.on('finish', () => resolve(filename))
      res.body.pipe(fileStream)
    })
  })
}

export const createFile = async (url: string) => {
  const downloadedFile = await downloadFile(url)
  if (!downloadedFile) {
    throw new Error('Failed to download file')
  }
  console.log('Downloaded file:', downloadedFile)
  const stats = fs.statSync(downloadedFile as string)
  console.log('File size:', stats.size)
  const file = await openai.files.create({
    file: fs.createReadStream(downloadedFile as string),
    purpose: 'assistants'
  })
  console.log(file)
  return file
}

export const deleteFile = async (storageFileId: string) => {
  return await openai.files.del(storageFileId)
}

export const createVectorStoreFile = async (vectorStoreId: string, storageFile: any) => {
  const vectorStoreFile = await openai.beta.vectorStores.files.create(vectorStoreId, {
    file_id: storageFile.id
  })
  console.log(vectorStoreFile)
  return vectorStoreFile
}

export const deleteVectorStoreFile = async (vectorStoreId: string, vectorStoreFileId: string) => {
  return await openai.beta.vectorStores.files.del(vectorStoreId, vectorStoreFileId)
}

export const createAssistant = async (user_metadata: any) => {
  let instructions = getInstructions(user_metadata)
  console.log('Creating assistant with instructions:', instructions)
  const assistant = await openai.beta.assistants.create({
    instructions,
    name: 'Author Assistant',
    model: 'gpt-4o',
    tools: [{ type: 'file_search' }, { type: 'code_interpreter' }]
  })
  console.log('Created assistant:', assistant)
  const vectorStore = await createVectorStore()
  console.log('Created vector store:', vectorStore)
  await openai.beta.assistants.update(assistant.id, {
    tool_resources: { file_search: { vector_store_ids: [vectorStore.id] } }
  })
  return { assistant, vectorStore }
}

const createVectorStore = async () => {
  return await openai.beta.vectorStores.create({
    name: 'Books'
  })
}

export const updateAssistant = async (assistantId: string, user_metadata: any) => {
  let instructions = getInstructions(user_metadata)
  console.log('Updating assistant with instructions:', instructions)
  return await openai.beta.assistants.update(assistantId, {
    instructions,
    model: 'gpt-4o',
    tools: [{ type: 'file_search' }, { type: 'code_interpreter' }]
  })
}

export const getVectorStoreId = async (assistantId: string) => {
  const assistant = await openai.beta.assistants.retrieve(assistantId)
  return assistant.tool_resources?.file_search?.vector_store_ids?.[0] // Fix: Added nullish coalescing operator
}

function getInstructions(user_metadata: any) {
  let instructions =
    "You are an author's assistant. You have knowledge of the author's books and other Source Material in your knowledge base, and you use this to create helpful content for them. You are able to search through the author's book transcripts using the \"file_search\" tool. You may be asked to generate content using these transcripts, or you may be asked general questions about it.  You can generate social media content, newsletters, marketing materials, coursework, and more.  Your goal is to create as much helpful content for author as possible."
  if (user_metadata) {
    if (user_metadata.writing_style) {
      instructions += `\n\nThe author's writing style is: \n'''\n${user_metadata.writing_style}.\n'''`
    }
    if (user_metadata.bio) {
      instructions += `\n\nThe author's bio is: \n'''\n${user_metadata.bio}.\n'''`
    }
  }
  return instructions
}
