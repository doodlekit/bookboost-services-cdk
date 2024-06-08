import { createNotification } from '../db'
import { sendNotification } from '../push'

export default async function (source: string, eventType: string, body: any) {
  console.log('Event received:', source, eventType, body)
  const userId = body.content.user_id
  // Save the event to the database
  const notification = await createNotification(userId, {
    content: 'Content generated',
    type: eventType,
    source: source
  })

  // Send SMS notification (eventually)

  // Trigger push notification
  await sendNotification(notification)
}
