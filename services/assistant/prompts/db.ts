import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'

import * as AWSXray from 'aws-xray-sdk'
const client = AWSXray.captureAWSv3Client(new DynamoDBClient())
const dynamo = DynamoDBDocumentClient.from(client)

import { ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'

import {
  pascalToSnakeKeys,
  getUpdateExpression,
  getExpressionAttributeValues,
  getExpressionAttributeNames
} from '../../core/db'
const tableName = process.env.PROMPT_TABLE

export const getPrompts = async () => {
  const records = await dynamo.send(
    new ScanCommand({
      TableName: tableName
    })
  )
  return records.Items?.map(pascalToSnakeKeys)
}

export const updatePrompt = async (contentType: string, prompt: any) => {
  const record: any = {
    UpdatedAt: new Date().toISOString(),
    Constraints: prompt.constraints,
    Context: prompt.context,
    Goal: prompt.goal,
    Length: prompt.length,
    OutputFormat: prompt.output_format,
    PromptStart: prompt.prompt_start,
    TargetAudience: prompt.target_audience,
    Tone: prompt.tone
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
        ContentType: contentType
      },
      UpdateExpression: 'SET ' + updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues
    })
  )
}
