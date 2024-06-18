import { EventBridgeEvent } from 'aws-lambda/trigger/eventbridge'
import { routeEvent } from './router'
const socketUrl = process.env.SOCKET_URL

export const handler = async (event: EventBridgeEvent<any, any>) => {
  console.log('Event:', event)
  const message = event.detail
  const type = event['detail-type']
  const source = event.source
  await routeEvent(source, type, message)
}
