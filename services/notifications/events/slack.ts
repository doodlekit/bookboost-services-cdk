import axios from 'axios'

export const sendSlackNotification = async (notification: any) => {
  if (process.env.SEND_SLACK_NOTIFICATIONS !== 'true') return
  await axios.post('https://hook.us1.make.com/jjicdvdnmp8lpamuysl01n0rh8u4dtf7', {
    userId: notification.user_id,
    userFullName: notification.user_full_name,
    userEmail: notification.user_email,
    message: notification.content,
    priority: 'high',
    timestamp: notification.created_at
  })
}
