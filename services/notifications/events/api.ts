import { APIGatewayEvent } from 'aws-lambda'
import { getUserId } from '../../core/auth'
import { getNotificationsPaginated } from './db'

export const list = async (event: APIGatewayEvent) => {
  console.log('event: ', event)
  const userId = getUserId(event)
  const perPage: number = +(event.queryStringParameters?.perPage || 10)
  const lastEvaluatedKey = event.queryStringParameters?.lastEvaluatedKey
  const notifications = await getNotificationsPaginated(userId, perPage, lastEvaluatedKey)

  return {
    statusCode: 200,
    body: JSON.stringify(notifications)
  }
}
