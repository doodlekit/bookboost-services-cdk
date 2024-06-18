import { createNotification } from '../db'
import { sendNotification } from '../push'
import { sendContentGeneratedEmail } from './mailer'

export default async function (source: string, eventType: string, body: any) {
  console.log('Event received:', source, eventType, body)
  const userId = body.content.user_id

  if (eventType === 'scheduled.content.generated') {
    await sendContentGeneratedEmail(body.content)
  }

  // Save the event to the database
  const notification = await createNotification(userId, {
    content: `New ${body.content.content_type} generated`,
    type: eventType,
    source: source
  })

  // Send SMS notification (eventually)

  // Trigger push notification
  await sendNotification(notification)
}
