import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DeleteCommandInput, DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuidv4 } from 'uuid'

import * as AWSXray from 'aws-xray-sdk'
const client = AWSXray.captureAWSv3Client(new DynamoDBClient())

const dynamo = DynamoDBDocumentClient.from(client)

import { DeleteCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'

const tableName = process.env.CHAPTERS_TABLE

export const getChapters = async (audiobookId: string) => {
  const records = await dynamo.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'AudiobookId = :audiobookId',
      ExpressionAttributeValues: {
        ':audiobookId': audiobookId
      }
    })
  )
  return records.Items?.map(pascalToSnakeKeys)
}

export const createChapter = async (userId: string, audiobookId: string, chapter: any) => {
  const id = uuidv4()
  const record: any = {
    Id: id,
    AudiobookId: audiobookId,
    UserId: userId,
    Order: chapter.order,
    Title: chapter.title,
    AudioUrl: chapter.audio_url,
    TranscriptUrl: chapter.transcript_url,
    CreatedAt: new Date().toISOString(),
    UpdatedAt: new Date().toISOString()
  }
  await dynamo.send(
    new PutCommand({
      TableName: tableName,
      Item: record
    })
  )
  return pascalToSnakeKeys(record)
}

export const deleteChapter = async (audiobookId: string, id: string) => {
  const deleteInput: DeleteCommandInput = {
    TableName: tableName,
    Key: {
      AudiobookId: audiobookId,
      Id: id
    }
  }
  console.log('deleteInput', deleteInput)
  await dynamo.send(new DeleteCommand(deleteInput))
}

// Not scoped by userId so this should only be used for interal operations
export const deleteChapters = async (audiobookId: string) => {
  const records = await dynamo.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'AudiobookId = :audiobookId',
      ExpressionAttributeValues: {
        ':audiobookId': audiobookId
      }
    })
  )
  const promises = records.Items?.map((record: any) => deleteChapter(audiobookId, record.Id))
  if (!promises) return
  await Promise.all(promises)
}

const pascalToSnakeKeys = (obj: any) => {
  const newObj: any = {}
  for (const key in obj) {
    const newKey = key
      .split(/\.?(?=[A-Z])/)
      .join('_')
      .toLowerCase()
    newObj[newKey] = obj[key]
  }
  return newObj
}
