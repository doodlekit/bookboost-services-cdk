import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb'
import { PutCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuidv4 } from 'uuid'
import * as AWSXray from 'aws-xray-sdk'
const client = AWSXray.captureAWSv3Client(new DynamoDBClient())
const dynamo = DynamoDBDocumentClient.from(client)
const assistansTableName = process.env.ASSISTANTS_TABLE

export const getAssistantByUserId = async (userId: string) => {
  const records = await dynamo.send(
    new ScanCommand({
      TableName: assistansTableName,
      FilterExpression: 'UserId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    })
  )
  console.log('Records:', records)
  if (!records.Items || records.Items.length === 0) {
    return null
  }
  return transformFromDb(records.Items[0])
}

export const createAssistant = async (userId: string, openAiAssistantId: string) => {
  const id = uuidv4()
  const record: any = {
    Id: id,
    UserId: userId,
    OpenAiAssistantId: openAiAssistantId,
    CreatedAt: new Date().toISOString(),
    UpdatedAt: new Date().toISOString()
  }
  await dynamo.send(
    new PutCommand({
      TableName: assistansTableName,
      Item: record
    })
  )
  return transformFromDb(record)
}

function transformFromDb(file: any) {
  return {
    id: file.Id,
    user_id: file.UserId,
    openai_assistant_id: file.OpenAiAssistantId,
    created_at: file.CreatedAt,
    updated_at: file.UpdatedAt
  }
}
