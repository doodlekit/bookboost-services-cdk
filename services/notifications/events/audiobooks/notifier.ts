import { createNotification } from '../db'
import { sendNotification } from '../push'
import { sendAudiobookEmail, sendRevisionEmail } from './mailer'

export default async function (source: string, eventType: string, body: any) {
  console.log('Event received:', source, eventType, body)
  if (source === 'services.audiobooks' && eventType === 'revision.created') {
    await sendRevisionNotification(source, eventType, body.revision)
  } else if (source === 'services.audiobooks' && eventType === 'audiobook.created') {
    await sendAudiobookNotification(source, eventType, body.audiobook)
  }
}

async function sendRevisionNotification(source: string, eventType: string, revision: any) {
  // Save the event to the database
  const userId = revision.user_id
  // Save the event to the database
  await sendRevisionEmail(revision)
  if (revision.type === 'RESPONSE') {
    const notification = await createNotification(userId, {
      content: 'New audibook revision',
      type: eventType,
      object_type: 'audiobook',
      object_id: revision.audiobook_id,
      source: source
    })
    await sendNotification(notification)
  }
}

async function sendAudiobookNotification(source: string, eventType: string, audiobook: any) {
  // Save the event to the database
  // const userId = audiobook.user_id
  // Save the event to the database
  // const notification = await createNotification(userId, {
  //   content: 'Audiobook created',
  //   type: eventType,
  //   source: source
  // })
  await sendAudiobookEmail(audiobook)
  // await sendNotification(notification)
}
