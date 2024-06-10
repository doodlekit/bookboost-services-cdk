import { APIGatewayEvent } from 'aws-lambda'
import { getUserId } from '../../core/auth'
import { getStatus, saveStatus } from './db'

export const update = async (event: APIGatewayEvent) => {
  console.log('event: ', event)
  const userId = getUserId(event)
  const status = JSON.parse(event.body || '{}')

  await saveStatus(userId, status)

  return {
    statusCode: 200
  }
}

export const get = async (event: APIGatewayEvent) => {
  console.log('event: ', event)
  const userId = getUserId(event)

  const status = await getStatus(userId)

  return {
    statusCode: 200,
    body: JSON.stringify(status)
  }
}
