import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DeleteCommandInput, DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb'

import * as AWSXray from 'aws-xray-sdk'
const client = AWSXray.captureAWSv3Client(new DynamoDBClient())

const dynamo = DynamoDBDocumentClient.from(client)

import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand
} from '@aws-sdk/lib-dynamodb'
import { v4 as uuidv4 } from 'uuid'

const tableName = process.env.AUDIOBOOKS_TABLE

export const getAudiobook = async (userId: string, id: string) => {
  const record = await dynamo.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        UserId: userId,
        Id: id
      }
    })
  )
  if (!record.Item) return null
  return pascalToSnakeKeys(record.Item)
}

export const getAudiobooks = async (userId: string) => {
  const records = await dynamo.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'UserId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    })
  )
  return records.Items?.map(pascalToSnakeKeys)
}

export const createAudiobook = async (userId: string, audiobook: any) => {
  const id = uuidv4()
  const record: any = {
    Id: id,
    UserId: userId,
    Title: audiobook.title,
    TranscriptTitle: audiobook.transcript_title,
    TranscriptUrl: audiobook.transcript_url,
    ElevenLabsVoiceId: audiobook.eleven_labs_voice_id,
    VoiceUrl: audiobook.voice_url,
    VoiceName: audiobook.voice_name,
    VoiceType: audiobook.voice_type,
    Language: audiobook.language,
    State: 'CREATED',
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

export const updateAudiobook = async (userId: string, id: string, audiobook: any) => {
  const record: any = {
    UpdatedAt: new Date().toISOString()
  }
  if (audiobook.state) {
    record.State = audiobook.state
  }
  if (audiobook.sample_url) {
    record.SampleUrl = audiobook.sample_url
  }
  if (audiobook.final_url) {
    record.FinalUrl = audiobook.final_url
  }
  const updateExpression = Object.keys(record)
    .map((i: any) => `#${i} = :value${i}`)
    .join(', ')
  const expressionAttributeValues = Object.keys(record).reduce(
    (acc: any, i: any) => ({
      ...acc,
      [`:value${i}`]: record[i]
    }),
    {}
  )

  const expressionAttributeNames = Object.keys(record).reduce(
    (acc: any, i: any) => ({
      ...acc,
      [`#${i}`]: i
    }),
    {}
  )

  console.log('updateExpression', updateExpression)
  console.log('expressionAttributeValues', expressionAttributeValues)
  console.log('expressionAttributeNames', expressionAttributeNames)

  await dynamo.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        UserId: userId,
        Id: id
      },
      UpdateExpression: 'SET ' + updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: {
        ...expressionAttributeValues
      }
    })
  )
}

export const deleteAudiobook = async (userId: string, id: string) => {
  const deleteInput: DeleteCommandInput = {
    TableName: tableName,
    Key: {
      UserId: userId,
      Id: id
    }
  }
  console.log('deleteInput', deleteInput)
  await dynamo.send(new DeleteCommand(deleteInput))
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
