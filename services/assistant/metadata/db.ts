import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand
} from '@aws-sdk/lib-dynamodb'

import * as AWSXray from 'aws-xray-sdk'
const client = AWSXray.captureAWSv3Client(new DynamoDBClient())
const dynamo = DynamoDBDocumentClient.from(client)

const tableName = process.env.USER_METADATA_TABLE

import {
  getUpdateExpression,
  getExpressionAttributeValues,
  getExpressionAttributeNames
} from '../../core/db'

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
    writing_style: record.Item.WritingStyle,
    assistant_name: record.Item.AssistantName
  }
}

export const updateMetadata = async (userId: string, metadata: any) => {
  const record: any = {
    UpdatedAt: new Date().toISOString(),
    Bio: metadata.bio,
    WritingStyle: metadata.writing_style,
    AssistantName: metadata.assistant_name
  }
  const updateExpression = getUpdateExpression(record)
  const expressionAttributeValues = getExpressionAttributeValues(record)
  const expressionAttributeNames = getExpressionAttributeNames(record)
  console.log('updateExpression', updateExpression)
  console.log('expressionAttributeValues', expressionAttributeValues)
  console.log('expressionAttributeNames', expressionAttributeNames)

  await dynamo.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        UserId: userId
      },
      UpdateExpression: 'SET ' + updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues
    })
  )
}
