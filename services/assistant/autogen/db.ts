import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  PutCommandInput,
  GetCommand
} from '@aws-sdk/lib-dynamodb'
import { v4 as uuidv4 } from 'uuid'

import * as AWSXray from 'aws-xray-sdk'
const client = AWSXray.captureAWSv3Client(new DynamoDBClient())
const dynamo = DynamoDBDocumentClient.from(client)
const tableName = process.env.AUTOGEN_TABLE

export async function createAutogen(autogen: any) {
  const id = uuidv4()
  const params: PutCommandInput = {
    TableName: tableName,
    Item: {
      Id: id,
      UserId: autogen.userId,
      Email: autogen.email,
      ContentType: autogen.contentType,
      ContentToGenerate: autogen.contentToGenerate,
      SourceMaterial: autogen.sourceMaterial,
      Topic: autogen.topic,
      CronExpression: autogen.cronExpression,
      CronTimeZone: autogen.cronTimeZone,
      SchedulerArn: autogen.schedulerArn
    }
  }

  await dynamo.send(new PutCommand(params))
}

export async function getAllAutogens(userId: string) {
  const items = await dynamo.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'UserId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    })
  )
  return items.Items?.map(pascalToSnakeKeys)
}

export async function getAutogen(userId: string, id: string) {
  const record = await dynamo.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        UserId: userId,
        Id: id
      }
    })
  )
  if (!record.Item) {
    return null
  }

  return pascalToSnakeKeys(record.Item)
}

export async function deleteAutogen(userId: string, id: string) {
  await dynamo.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        UserId: userId,
        Id: id
      }
    })
  )
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
