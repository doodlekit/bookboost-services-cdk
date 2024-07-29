import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  UpdateCommand,
  QueryCommand,
  QueryCommandInput
} from '@aws-sdk/lib-dynamodb'
import { GetCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuidv4 } from 'uuid'
import * as AWSXray from 'aws-xray-sdk'
const client = AWSXray.captureAWSv3Client(new DynamoDBClient())
const dynamo = DynamoDBDocumentClient.from(client)
const tableName = process.env.NOTIFICATIONS_TABLE
const indexName = process.env.NOTIFICATIONS_INDEX

export const createNotification = async (profile: any, notificaton: any) => {
  const id = uuidv4()

  const createdAt = new Date().toISOString()
  await dynamo.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        UserId: profile.user_id,
        UserEmail: profile.email,
        UserFullName: profile.full_name,
        Id: id,
        Content: notificaton.content,
        Read: false,
        Type: notificaton.type,
        Source: notificaton.source,
        ObjectId: notificaton.object_id,
        ObjectType: notificaton.object_type,
        CreatedAt: createdAt
      }
    })
  )
  return {
    id,
    created_at: createdAt,
    user_id: profile.user_id,
    ...notificaton
  }
}

export const getNotificationsPaginated = async (
  userId: string,
  limit: number,
  lastEvaluatedKey: any
) => {
  const input: QueryCommandInput = {
    TableName: tableName,
    IndexName: indexName,
    KeyConditionExpression: 'UserId = :userId',
    ExpressionAttributeValues: {
      ':userId': userId
    },
    Limit: limit,
    ScanIndexForward: false
  }
  if (lastEvaluatedKey) {
    input.ExclusiveStartKey = lastEvaluatedKey
  }
  const response = await dynamo.send(new QueryCommand(input))
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
        UpdateExpression: 'SET #read = :read',
        ExpressionAttributeNames: {
          '#read': 'Read'
        },
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
    const input: QueryCommandInput = {
      TableName: tableName,
      KeyConditionExpression: 'UserId = :userId',
      FilterExpression: '#read = :read',
      ExpressionAttributeNames: {
        '#read': 'Read'
      },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':read': false
      }
    }
    if (lastEvaluatedKey) {
      input.ExclusiveStartKey = lastEvaluatedKey
    }
    const response: any = await dynamo.send(new QueryCommand(input))
    if (response.Items) {
      const ids = response.Items.map((n: any) => n.Id)
      await markAsRead(userId, ids)
    }
    lastEvaluatedKey = response.LastEvaluatedKey
  } while (lastEvaluatedKey)
}

export const deleteNotification = async (userId: string, id: string) => {
  await dynamo.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        UserId: userId,
        Id: id
      }
    })
  )
}

const transformNotification = (notification: any) => {
  return {
    id: notification.Id,
    content: notification.Content,
    read: notification.Read,
    type: notification.Type,
    source: notification.Source,
    object_id: notification.ObjectId,
    object_type: notification.ObjectType,
    created_at: notification.CreatedAt
  }
}
