import { deleteConnection, getConnections, saveConnection } from './db'

export const connect = async function (event: any) {
  const connectionId = event.requestContext.connectionId
  const userId = atob(event.queryStringParameters.userId)
  try {
    await saveConnection(userId, connectionId)

    return { statusCode: 200, body: 'Connection saved' }
  } catch (error) {
    console.error('Error saving connection:', error)
    return { statusCode: 500, body: 'Failed to save connection' }
  }
}

export const disconnect = async function (event: any) {
  const connectionId = event.requestContext.connectionId
  await deleteConnection(connectionId)
  return { statusCode: 200, body: 'Connection destroyed' }
}
