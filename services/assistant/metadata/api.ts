import { updateAssistant } from '../openai/assistant'
import { getUserId } from '../../core/auth'
import { getAssistantByUserId } from '../openai/db'
import { updateMetadata, getMetadata } from './db'

export const update = async (event: any) => {
  const userId = getUserId(event)
  const metadata = JSON.parse(event.body)
  await updateMetadata(userId, metadata)
  const assistant = await getAssistantByUserId(userId)
  if (assistant) {
    await updateAssistant(assistant.openai_assistant_id, metadata)
  }
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Metadata updated successfully!' }),
    headers: { 'Content-Type': 'application/json' }
  }
}

export const get = async (event: any) => {
  const userId = getUserId(event)
  const metadata = await getMetadata(userId)
  return {
    statusCode: 200,
    body: JSON.stringify(metadata),
    headers: { 'Content-Type': 'application/json' }
  }
}
