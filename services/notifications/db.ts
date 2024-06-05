import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
  QueryCommand,
  DeleteCommand
} from '@aws-sdk/lib-dynamodb'
import * as AWSXray from 'aws-xray-sdk'
const client = AWSXray.captureAWSv3Client(new DynamoDBClient())
const dynamo = DynamoDBDocumentClient.from(client)
const tableName = process.env.CONNECTIONS_TABLE

export const saveConnection = async (userId: string, connectionId: string) => {
  console.log('Saving connection:', connectionId, 'for user:', userId)

  return await dynamo.send(
    new PutCommand({
      Item: {
        UserId: userId,
        ConnectionId: connectionId,
        TimeToLive: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7
      },
      TableName: tableName
    })
  )
}

export const getConnections = async (userId: string) => {
  const items = await dynamo.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'UserId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    })
  )
  if (!items.Items) {
    return []
  }
  return items.Items.map(transformFromDb)
}

export const deleteConnection = async (connectionId: string) => {
  const connections = await dynamo.send(
    new ScanCommand({
      TableName: tableName,
      FilterExpression: 'ConnectionId = :connectionId',
      ExpressionAttributeValues: {
        ':connectionId': connectionId
      }
    })
  )
  if (!connections.Items) {
    return
  }
  for (const connection of connections.Items) {
    await dynamo.send(
      new DeleteCommand({
        TableName: tableName,
        Key: {
          UserId: connection.UserId,
          ConnectionId: connection.ConnectionId
        }
      })
    )
  }
}

const transformFromDb = (record: any) => {
  return {
    user_id: record.UserId,
    connection_id: record.ConnectionId
  }
}
