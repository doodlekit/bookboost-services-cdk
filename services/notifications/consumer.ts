import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand
} from '@aws-sdk/client-apigatewaymanagementapi'
import { EventBridgeEvent } from 'aws-lambda/trigger/eventbridge'
import { getConnections } from './db'
const socketUrl = process.env.SOCKET_URL

export const handler = async (event: EventBridgeEvent<any, any>) => {
  console.log('Event:', event)
  const message = event.detail
  const type = event['detail-type']
  switch (type) {
    case 'content.generated':
      const body = {
        type: 'content.generated',
        content: message.content
      }
      await sendNotification(message.content.user_id, body)
      return
  }
}

const sendNotification = async (userId: string, body: any) => {
  // Alert frontend via socket connection that the content is in the DB
  const apiClient = new ApiGatewayManagementApiClient({
    endpoint: socketUrl
  })
  const connections = await getConnections(userId)
  for (const connection of connections) {
    console.log('Attempting this connection: ', connection)
    console.log('SocketUrl: ', socketUrl)
    try {
      const apiGatewayInput = {
        // PostToConnectionRequest
        Data: JSON.stringify(body),
        ConnectionId: connection.connection_id
      }
      const apiCommand = new PostToConnectionCommand(apiGatewayInput)
      const apiResponse = await apiClient.send(apiCommand)
      console.log('Socket response: ', apiResponse)
      console.log('Successfully sent message on this socket connection: ', connection)
    } catch (err) {
      console.log(err)
    }
  }
}
