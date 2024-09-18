import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { GetCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuidv4 } from 'uuid'
import * as AWSXray from 'aws-xray-sdk'
const client = AWSXray.captureAWSv3Client(new DynamoDBClient())
const dynamo = DynamoDBDocumentClient.from(client)
const tableName = process.env.PARTS_TABLE
import {
  getUpdateExpression,
  getExpressionAttributeValues,
  getExpressionAttributeNames
} from '../../core/db'

export const getPart = async (jobId: string, id: string) => {
  const record = await dynamo.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        JobId: jobId,
        Id: id
      }
    })
  )
  if (!record.Item || record.Item.JobId !== jobId) return null
  return transformFromDb(record.Item)
}

export const getParts = async (jobId: string) => {
  const items = await dynamo.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'JobId = :jobId',
      ExpressionAttributeValues: {
        ':jobId': jobId
      }
    })
  )
  return items.Items?.map(transformFromDb)
}

export const createPart = async (jobId: string, part: any) => {
  const id = uuidv4()
  const record: any = {
    Id: id,
    JobId: jobId,
    Contents: part.contents,
    Flag: part.flag || false,
    Error: part.error || '',
    Order: part.order || 0,
    Processed: part.processed || false,
    CreatedAt: new Date().toISOString(),
    UpdatedAt: new Date().toISOString()
  }
  await dynamo.send(
    new PutCommand({
      TableName: tableName,
      Item: record
    })
  )
  return transformFromDb(record)
}

export const updatePart = async (jobId: string, id: string, part: any) => {
  const record: any = {
    UpdatedAt: new Date().toISOString(),
    Contents: part.contents,
    Flag: part.flag,
    Error: part.error,
    Processed: part.processed,
    Order: part.order
  }
  const updateExpression = getUpdateExpression(record)
  const expressionAttributeValues = getExpressionAttributeValues(record)
  const expressionAttributeNames = getExpressionAttributeNames(record)
  await dynamo.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        JobId: jobId,
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

export const deletePart = async (jobId: string, id: string) => {
  await dynamo.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        JobId: jobId,
        Id: id
      },
      ConditionExpression: 'JobId = :jobid',
      ExpressionAttributeValues: {
        ':jobid': jobId
      }
    })
  )
}

function transformFromDb(part: any) {
  return {
    id: part.Id,
    user_id: part.UserId,
    created_at: part.CreatedAt,
    job_id: part.JobId,
    contents: part.Contents,
    flag: part.Flag,
    error: part.Error,
    processed: part.Processed,
    order: part.Order
  }
}
