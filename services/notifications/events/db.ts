import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { GetCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuidv4 } from 'uuid'
import * as AWSXray from 'aws-xray-sdk'
// const client = AWSXray.captureAWSv3Client(new DynamoDBClient())
const client = new DynamoDBClient()
const dynamo = DynamoDBDocumentClient.from(client)
const tableName = process.env.NOTIFICATIONS_TABLE

export const createNotification = async (userId: string, notificaton: any) => {
  const id = uuidv4()

  const createdAt = new Date().toISOString()
  await dynamo.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        UserId: userId,
        Id: id,
        Content: notificaton.content,
        Read: false,
        Type: notificaton.type,
        Source: notificaton.source,
        CreatedAt: createdAt
      }
    })
  )
  return {
    id,
    created_at: createdAt,
    user_id: userId,
    ...notificaton
  }
}

export const getNotifications = async (userId: string) => {
  const response = await dynamo.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'UserId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    })
  )
  if (!response.Items) {
    return []
  }
  return response.Items?.map(transformNotification)
}

export const getNotificationsPaginated = async (
  userId: string,
  limit: number,
  lastEvaluatedKey: any
) => {
  const response = await dynamo.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'UserId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      },
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey
    })
  )
  if (!response.Items) {
    return []
  }
  return {
    items: response.Items?.map(transformNotification),
    lastEvaluatedKey: response.LastEvaluatedKey
  }
}

export const markAsRead = async (userId: string, ids: string[]) => {
  for (const id of ids) {
    await dynamo.send(
      new UpdateCommand({
        TableName: tableName,
        Key: {
          UserId: userId,
          Id: id
        },
        UpdateExpression: 'SET Read = :read',
        ExpressionAttributeValues: {
          ':read': true
        }
      })
    )
  }
}

export const markAllAsRead = async (userId: string) => {
  // Scan the table for all unread notifications for the user
  // Look through all pages using the LastEvaluatedKey
  let lastEvaluatedKey = null
  do {
    const response: any = await dynamo.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'UserId = :userId',
        FilterExpression: 'Read = :read',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':read': false
        },
        ExclusiveStartKey: lastEvaluatedKey
      })
    )
    if (response.Items) {
      const ids = response.Items.map((n: any) => n.Id)
      await markAsRead(userId, ids)
    }
    lastEvaluatedKey = response.LastEvaluatedKey
  } while (lastEvaluatedKey)
}

const transformNotification = (notification: any) => {
  return {
    id: notification.Id,
    content: notification.Content,
    read: notification.Read,
    type: notification.Type,
    source: notification.Source,
    created_at: notification.CreatedAt
  }
}
