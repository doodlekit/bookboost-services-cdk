import { getProfile } from '../../profiles/db'
import { sendMessage } from '../../sms'
import { createNotification } from '../db'
import { sendNotification } from '../push'
import { sendSlackNotification } from '../slack'
import { sendAudiobookEmail, sendRevisionEmail } from './mailer'
import revesionTemplate from './templates/revision-response'

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
  const profile = await getProfile(userId)
  // Save the event to the database
  await sendRevisionEmail(profile, revision)
  if (revision.type === 'RESPONSE') {
    const notification = await createNotification(profile, {
      content: 'New audibook revision',
      type: eventType,
      object_type: 'audiobook',
      object_id: revision.audiobook_id,
      source: source
    })
    await sendNotification(notification)
    if (revision.send_sms && profile && profile.phone) {
      await sendMessage(profile.phone, revesionTemplate.getSmsBody(revision))
    }
  } else {
    try {
      // Send slack notification
      await sendSlackNotification({
        user_id: userId,
        user_full_name: profile.full_name,
        user_email: profile.email,
        content: 'New audibook revision request\n\n' + revision.notes,
        created_at: new Date().toISOString()
      })
    } catch (error) {
      console.error('Error sending slack notification', error)
    }
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
  try {
    const userId = audiobook.user_id
    const profile = await getProfile(userId)
    // Send slack notification
    await sendSlackNotification({
      user_id: profile.user_id,
      user_full_name: profile.full_name,
      user_email: profile.email,
      content: 'New audibook ready to be created',
      created_at: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error sending slack notification', error)
  }
}
