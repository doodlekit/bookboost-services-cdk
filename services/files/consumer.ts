import { EventBridgeEvent } from 'aws-lambda/trigger/eventbridge'
import { updateAssistant, updateFile, updateFileError } from './files/db'

export const handler = async (event: EventBridgeEvent<any, any>) => {
  console.log('Event:', event)
  const message = event.detail
  const type = event['detail-type']
  switch (type) {
    case 'assistant.file.created':
      await updateAssistant(
        message.user_id,
        message.file_id,
        message.storage_file_id,
        message.vector_store_id,
        message.vector_store_file_id
      )
      return
    case 'assistant.file.error':
      await updateFileError(message.user_id, message.file_id, message.error)
      return
    case 'job.completed':
    case 'job.extracted':
      const job = message.job
      const userId = job.user_id
      const fileId = job.file.id
      await updateFile(userId, fileId, {
        contents_object: job.chapters_object,
        contents_extraction_evaluation: job.extraction_evaluation,
        converted_file: job.converted_file
      })
      return
    default:
      return {
        body: 'Method Not Allowed'
      }
  }
}
