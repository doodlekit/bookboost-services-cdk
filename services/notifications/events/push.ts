import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand
} from '@aws-sdk/client-apigatewaymanagementapi'
import { getConnections } from '../socket/db'
const socketUrl = process.env.SOCKET_URL

export const sendNotification = async (notification: any) => {
  console.log('Sending notification:', notification)
  // Alert frontend via socket connection that the content is in the DB
  const apiClient = new ApiGatewayManagementApiClient({
    endpoint: socketUrl
  })
  const connections = await getConnections(notification.user_id)
  for (const connection of connections) {
    console.log('Attempting this connection: ', connection)
    console.log('SocketUrl: ', socketUrl)
    try {
      const apiGatewayInput = {
        // PostToConnectionRequest
        Data: JSON.stringify(notification),
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
