import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { GetCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuidv4 } from 'uuid'
import * as AWSXray from 'aws-xray-sdk'
const client = AWSXray.captureAWSv3Client(new DynamoDBClient())
const dynamo = DynamoDBDocumentClient.from(client)
const tableName = process.env.FILES_TABLE
import {
  getUpdateExpression,
  getExpressionAttributeValues,
  getExpressionAttributeNames
} from '../../core/db'

export const updateAssistant = async (
  userId: string,
  fileId: string,
  storageFileId: string,
  vectorStoreFileId: string,
  vectorStoreId: string
) => {
  console.log('Updating file:', fileId, 'with vectorStore file:', vectorStoreFileId)

  return await dynamo.send(
    new UpdateCommand({
      Key: {
        UserId: userId,
        Id: fileId
      },
      UpdateExpression:
        'set StorageFileId = :storageFileId, VectorStoreFileId = :vectorStoreFileId, VectorStoreId = :vectorStoreId',
      ExpressionAttributeValues: {
        ':storageFileId': storageFileId,
        ':vectorStoreFileId': vectorStoreFileId,
        ':vectorStoreId': vectorStoreId
      },
      TableName: tableName
    })
  )
}

export const getFile = async (userId: string, id: string) => {
  const record = await dynamo.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        UserId: userId,
        Id: id
      }
    })
  )
  if (!record.Item || record.Item.UserId !== userId) return null
  return transformFromDb(record.Item)
}

export const getFiles = async (userId: string) => {
  const items = await dynamo.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'UserId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    })
  )
  return items.Items?.map(transformFromDb)
}

export const createFile = async (userId: string, file: any) => {
  const id = uuidv4()
  const record: any = {
    Id: id,
    UserId: userId,
    FileName: file.file_name,
    Key: file.key,
    CreatedAt: new Date().toISOString(),
    UpdatedAt: new Date().toISOString()
  }
  record.TranscriptUrl = file.transcript_url
  record.ElevenLabsVoiceId = file.eleven_labs_voice_id
  await dynamo.send(
    new PutCommand({
      TableName: tableName,
      Item: record
    })
  )
  return transformFromDb(record)
}

export const updateFile = async (userId: string, id: string, file: any) => {
  const record: any = {
    UpdatedAt: new Date().toISOString(),
    FileName: file.file_name,
    ContentsObject: file.contents_object,
    ContentsExtractionEvaluation: file.contents_extraction_evaluation
  }
  const updateExpression = getUpdateExpression(record)
  const expressionAttributeValues = getExpressionAttributeValues(record)
  const expressionAttributeNames = getExpressionAttributeNames(record)
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
  return transformFromDb(record)
}

export const updateFileError = async (userId: string, id: string, error: string) => {
  await dynamo.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        UserId: userId,
        Id: id
      },
      UpdateExpression: 'SET #Error = :error',
      ExpressionAttributeNames: {
        '#Error': 'Error'
      },
      ExpressionAttributeValues: {
        ':error': error
      }
    })
  )
}

export const deleteFile = async (userId: string, id: string) => {
  await dynamo.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        UserId: userId,
        Id: id
      },
      ConditionExpression: 'UserId = :userid',
      ExpressionAttributeValues: {
        ':userid': userId
      }
    })
  )
}

function transformFromDb(file: any) {
  return {
    id: file.Id,
    user_id: file.UserId,
    file_name: file.FileName,
    created_at: file.CreatedAt,
    key: file.Key,
    vector_store_id: file.VectorStoreId || '',
    vector_store_file_id: file.VectorStoreFileId || '',
    storage_file_id: file.StorageFileId || '',
    url: `https://${process.env.ASSETS_DOMAIN}/${file.Key}`,
    is_ready: file.VectorStoreId ? true : false,
    error: file.Error || '',
    contents_object: file.ContentsObject || {},
    contents_extraction_evaluation: file.ContentsExtractionEvaluation || {}
  }
}
