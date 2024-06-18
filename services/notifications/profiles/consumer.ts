import { EventBridgeEvent } from 'aws-lambda/trigger/eventbridge'
import { saveProfile } from './db'
const socketUrl = process.env.SOCKET_URL

export const handler = async (event: EventBridgeEvent<any, any>) => {
  console.log('Event:', event)
  const message = event.detail
  const type = event['detail-type']
  switch (type) {
    case 'profile.updated':
      await onProfileUpdated(message.user)
      break
  }
}

const onProfileUpdated = async (user: any) => {
  const profile = {
    full_name: user.name,
    email: user.email,
    phone: user.user_metadata.phone
  }

  await saveProfile(user.user_id, profile)
}
