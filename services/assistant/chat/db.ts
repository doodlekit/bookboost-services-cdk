import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuidv4 } from 'uuid'
import * as AWSXray from 'aws-xray-sdk'
const client = AWSXray.captureAWSv3Client(new DynamoDBClient())
const dynamo = DynamoDBDocumentClient.from(client)
const chatSessionTableName = process.env.CHAT_SESSIONS_TABLE

export const createChatSession = async (
  userId: string,
  assistantId: string,
  threadId: string,
  jwt_token: string
) => {
  const id = uuidv4()
  const record: any = {
    Id: id,
    UserId: userId,
    AssistantId: assistantId,
    ThreadId: threadId,
    JwtToken: jwt_token,
    CreatedAt: new Date().toISOString()
  }
  await dynamo.send(
    new PutCommand({
      TableName: chatSessionTableName,
      Item: record
    })
  )
  return id
}

export const getChatSession = async (id: string) => {
  const item = await dynamo.send(
    new GetCommand({
      TableName: chatSessionTableName,
      Key: {
        Id: id
      }
    })
  )
  if (!item.Item) {
    return null
  }
  return {
    id: item.Item.Id,
    user_id: item.Item.UserId,
    assistant_id: item.Item.AssistantId,
    jwt_token: item.Item.JwtToken,
    thread_id: item.Item.ThreadId
  }
}
