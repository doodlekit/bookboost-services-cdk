import { deleteRevisions } from './revisions/db'
import { sendAudiobookEmail, sendRevisionEmail } from './notifications/mailer'
import { EventBridgeEvent } from 'aws-lambda/trigger/eventbridge'

export const handler = async (event: EventBridgeEvent<any, any>) => {
  console.log('Event:', event)
  const message = event.detail
  const type = event['detail-type']
  switch (type) {
    case 'audiobook.created':
      return await onAudiobookCreated(message.audiobook)
    case 'audiobook.deleted':
      return await onAudiobookDeleted(message.audiobook)
    case 'revision.created':
      return await onRevisionCreated(message.revision)
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

const onAudiobookCreated = async (audiobook: any) => {
  console.log('Sending email for audiobook:', audiobook.id)
  await sendAudiobookEmail(audiobook)
}

const onRevisionCreated = async (revision: any) => {
  console.log('Sending email for revision:', revision.id)
  await sendRevisionEmail(revision)
}
