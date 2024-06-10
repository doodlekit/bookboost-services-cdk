import { APIGatewayEvent } from 'aws-lambda'
import { getUserId } from '../../core/auth'
import { deleteNotification, getNotificationsPaginated, markAllAsRead, markAsRead } from './db'

export const list = async (event: APIGatewayEvent) => {
  console.log('event: ', event)
  const userId = getUserId(event)
  const perPage: number = +(event.queryStringParameters?.perPage || 10)
  const rawLastEvaluatedKey = event.queryStringParameters?.lastEvaluatedKey
  const lastEvaluatedKey = rawLastEvaluatedKey ? JSON.parse(atob(rawLastEvaluatedKey)) : null
  const notifications: any = await getNotificationsPaginated(userId, perPage, lastEvaluatedKey)

  return {
    statusCode: 200,
    body: JSON.stringify({
      items: notifications.items,
      lastEvaluatedKey: notifications.lastEvaluatedKey
        ? btoa(JSON.stringify(notifications.lastEvaluatedKey))
        : null
    })
  }
}

export const update = async (event: APIGatewayEvent) => {
  console.log('event: ', event)
  const userId = getUserId(event)
  const id = event.pathParameters?.id
  if (!id) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'id is required' })
    }
  }

  await markAsRead(userId, [id])

  return {
    statusCode: 200
  }
}

export const updateAll = async (event: APIGatewayEvent) => {
  console.log('event: ', event)
  const userId = getUserId(event)

  await markAllAsRead(userId)

  return {
    statusCode: 200
  }
}

export const destroy = async (event: APIGatewayEvent) => {
  console.log('event: ', event)
  const userId = getUserId(event)
  const id = event.pathParameters?.id
  if (!id) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'id is required' })
    }
  }

  await deleteNotification(userId, id)

  return {
    statusCode: 200
  }
}
