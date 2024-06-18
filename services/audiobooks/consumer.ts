import { deleteRevisions } from './revisions/db'
import { EventBridgeEvent } from 'aws-lambda/trigger/eventbridge'

export const handler = async (event: EventBridgeEvent<any, any>) => {
  console.log('Event:', event)
  const message = event.detail
  const type = event['detail-type']
  switch (type) {
    case 'audiobook.deleted':
      return await onAudiobookDeleted(message.audiobook)
    default:
      return {
        body: 'Method Not Allowed'
      }
  }
}

const onAudiobookDeleted = async (audiobook: any) => {
  console.log('Deleting revisions for audiobook:', audiobook.id)
  await deleteRevisions(audiobook.id)
}
