import {
  createAssistant,
  createVectorStoreFile,
  getVectorStoreId,
  createFile,
  deleteVectorStoreFile,
  deleteFile
} from './openai/assistant'

import { getMetadata } from './metadata/db'

import { getAssistantByUserId, createAssistant as saveAssistant } from './openai/db'
import { acquireLock, releaseLock } from './openai/lock'
import { publish } from '../core/messages'
import { generate } from './content/generator'

import { EventBridgeEvent } from 'aws-lambda/trigger/eventbridge'

export const handler = async (event: EventBridgeEvent<any, any>) => {
  console.log('Event:', event)
  const message = event.detail
  const type = event['detail-type']
  switch (type) {
    case 'file.created':
      const url = message.file.url
      const fileId = message.file.id
      const userId = message.file.user_id

      return await onFileCreated(url, userId, fileId)
    case 'file.deleted':
      const file = message.file
      return await onFileDeleted(file)
    case 'content.ready':
      const generationResponse = await generate(message.content)
      console.log('contentToGenerate', message.content.contentToGenerate)
      await publish('services.assistant', 'content.generated', {
        content: {
          user_id: message.content.userId,
          content_type: message.content.contentToGenerate,
          text_content: generationResponse
        }
      })
      return generationResponse

    default:
      return {
        body: 'Method Not Allowed'
      }
  }
}
async function onFileDeleted(file: any) {
  if (!file) {
    throw new Error('No file provided')
  }

  console.log('Deleting file:', file)
  await deleteVectorStoreFile(file.vector_store_id, file.vector_store_file_id)
  await deleteFile(file.storage_file_id)
  return {
    body: 'File deleted'
  }
}
async function onFileCreated(url: string, userId: string, fileId: string) {
  try {
    if (!url) {
      throw new Error('No URL provided')
    }

    let assistantId
    let vectorStoreId
    // Using a semaphore lock to prevent concurrent assistant creation
    await lockAssistant(userId, async () => {
      const response = await upsertAssistant(userId)
      assistantId = response.assistantId
      vectorStoreId = response.vectorStoreId
    })

    console.log('Assistant ID:', assistantId)
    console.log('Vector Store ID:', vectorStoreId)
    if (!assistantId || !vectorStoreId) {
      throw new Error('Assistant not found')
    }

    const storageFile = await createFile(url)
    const vectorStoreFile = await createVectorStoreFile(vectorStoreId, storageFile)
    await publish('services.assistant', 'assistant.file.created', {
      user_id: userId,
      file_id: fileId,
      storage_file_id: storageFile.id,
      vector_store_id: vectorStoreId,
      vector_store_file_id: vectorStoreFile.id
    })

    return {
      body: JSON.stringify({
        storage_file: storageFile,
        assistant_file: vectorStoreFile
      })
    }
  } catch (error: any) {
    console.error('Error in onFileCreated:', error)
    await publish('services.assistant', 'assistant.file.error', {
      user_id: userId,
      file_id: fileId,
      error: error.message
    })
    throw error
  }
}

async function upsertAssistant(userId: string) {
  let assistantId = (await getAssistantByUserId(userId))?.openai_assistant_id
  let vectorStoreId
  if (!assistantId) {
    const user_metadata = await getMetadata(userId)
    const { assistant, vectorStore } = await createAssistant(user_metadata)
    await saveAssistant(userId, assistant.id)
    vectorStoreId = vectorStore.id
    assistantId = assistant.id
  } else {
    vectorStoreId = await getVectorStoreId(assistantId)
  }
  return { assistantId, vectorStoreId }
}

async function lockAssistant(userId: any, callback: any) {
  try {
    const locked = await acquireLock(userId)
    if (!locked) {
      throw new Error('Could not acquire lock try again later')
    }

    await callback()
  } catch (error) {
    console.error('Error in lockAssistant:', error)
    throw error
  } finally {
    console.log('Finally release lock')
    await releaseLock(userId)
  }
}
