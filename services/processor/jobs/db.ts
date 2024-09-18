import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DeleteCommandInput, DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb'

import * as AWSXray from 'aws-xray-sdk'
const client = AWSXray.captureAWSv3Client(new DynamoDBClient())

const dynamo = DynamoDBDocumentClient.from(client)

import {
  pascalToSnakeKeys,
  getUpdateExpression,
  getExpressionAttributeValues,
  getExpressionAttributeNames
} from '../../core/db'

import { DeleteCommand, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuidv4 } from 'uuid'

const tableName = process.env.JOBS_TABLE

export const getJob = async (userId: string, id: string) => {
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

export const getJobs = async (userId: string) => {
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

export const createJob = async (userId: string, job: any) => {
  const id = uuidv4()
  const record: any = {
    Id: id,
    UserId: userId,
    Status: 'CREATED',
    File: job.file,
    CreatedAt: new Date().toISOString(),
    UpdatedAt: new Date().toISOString()
  }
  console.log('record', record)
  await dynamo.send(
    new PutCommand({
      TableName: tableName,
      Item: record
    })
  )
  return pascalToSnakeKeys(record)
}

export const updateJob = async (userId: string, id: string, job: any) => {
  const record: any = {
    UpdatedAt: new Date().toISOString(),
    Status: job.status,
    LastError: job.last_error,
    ConversionJobId: job.conversion_job_id,
    ChaptersObject: job.chapters_object,
    ExtractionEvaluation: job.extraction_evaluation,
    ConvertedFile: job.converted_file
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
}

export const deleteJob = async (userId: string, id: string) => {
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
