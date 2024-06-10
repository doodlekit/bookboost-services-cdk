import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import * as AWSXray from 'aws-xray-sdk'
const client = AWSXray.captureAWSv3Client(new DynamoDBClient())
const dynamo = DynamoDBDocumentClient.from(client)
const tableName = process.env.STATUS_TABLE

export const saveStatus = async (userId: string, status: any) => {
  const createdAt = new Date().toISOString()
  await dynamo.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        UserId: userId,
        HasUnread: status.has_unread,
        CreatedAt: createdAt
      }
    })
  )
  return {
    created_at: createdAt,
    user_id: userId,
    ...status
  }
}

export const getStatus = async (userId: string) => {
  const response = await dynamo.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'UserId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    })
  )
  if (!response.Items || response.Items.length === 0) {
    return {}
  }
  return transformStatus(response.Items[0])
}

const transformStatus = (item: any) => {
  return {
    user_id: item.UserId,
    has_unread: item.HasUnread,
    created_at: item.CreatedAt
  }
}
