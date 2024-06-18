import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import {
  getUpdateExpression,
  getExpressionAttributeValues,
  getExpressionAttributeNames
} from '../../core/db'
import * as AWSXray from 'aws-xray-sdk'
const client = AWSXray.captureAWSv3Client(new DynamoDBClient())
const dynamo = DynamoDBDocumentClient.from(client)
const tableName = process.env.PROFILES_TABLE

export const saveProfile = async (userId: string, profile: any) => {
  const record: any = {
    UpdatedAt: new Date().toISOString(),
    FullName: profile.full_name,
    Email: profile.email,
    Phone: profile.phone
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
      ExpressionAttributeValues: {
        ...expressionAttributeValues
      }
    })
  )
}
export const getProfile = async (userId: string) => {
  const response = await dynamo.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        UserId: userId
      }
    })
  )
  return transformProfile(response.Item)
}

const transformProfile = (item: any) => {
  return {
    user_id: item.UserId,
    full_name: item.FullName,
    email: item.Email,
    phone: item.Phone
  }
}
