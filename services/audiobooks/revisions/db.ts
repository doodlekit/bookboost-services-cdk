import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DeleteCommandInput, DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuidv4 } from 'uuid'

import * as AWSXray from 'aws-xray-sdk'
const client = AWSXray.captureAWSv3Client(new DynamoDBClient())

const dynamo = DynamoDBDocumentClient.from(client)

import { DeleteCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'

const tableName = process.env.REVISIONS_TABLE

export const getRevisions = async (userId: string, audiobookId: string) => {
  const records = await dynamo.send(
    new ScanCommand({
      TableName: tableName,
      FilterExpression: 'UserId = :userId AND AudiobookId = :audiobookId',
      ExpressionAttributeValues: {
        ':audiobookId': audiobookId,
        ':userId': userId
      }
    })
  )
  return records.Items?.map(pascalToSnakeKeys)
}

export const createRevision = async (userId: string, audiobookId: string, revision: any) => {
  const id = uuidv4()
  const record: any = {
    Id: id,
    AudiobookId: audiobookId,
    UserId: userId,
    UserEmail: revision.user_email,
    SendSms: revision.send_sms,
    Comment: revision.comment,
    SampleUrl: revision.sample_url,
    FinalUrl: revision.final_url,
    Notes: revision.notes,
    Sender: revision.sender,
    Type: revision.type,
    Attachments: revision.attachments,
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

export const deleteRevision = async (audiobookId: string, id: string) => {
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
export const deleteRevisions = async (audiobookId: string) => {
  const records = await dynamo.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'AudiobookId = :audiobookId',
      ExpressionAttributeValues: {
        ':audiobookId': audiobookId
      }
    })
  )
  const promises = records.Items?.map((record: any) => deleteRevision(audiobookId, record.Id))
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
