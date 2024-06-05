import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'

import * as AWSXray from 'aws-xray-sdk'
const client = AWSXray.captureAWSv3Client(new DynamoDBClient())
const dynamo = DynamoDBDocumentClient.from(client)

const tableName = process.env.USER_METADATA_TABLE

export const getMetadata = async (userId: string) => {
  const record = await dynamo.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        UserId: userId
      }
    })
  )
  if (!record.Item) {
    return null
  }
  return {
    id: record.Item.UserId,
    bio: record.Item.Bio,
    writing_style: record.Item.WritingStyle
  }
}

export const updateMetadata = async (userId: string, metadata: any) => {
  const record: any = {
    UserId: userId,
    UpdatedAt: new Date().toISOString(),
    Bio: metadata.bio,
    WritingStyle: metadata.writing_style
  }
  dynamo.send(
    new PutCommand({
      TableName: tableName,
      Item: record
    })
  )
}
