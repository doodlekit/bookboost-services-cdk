import { publish } from '../../core/messages'
import { getUserId } from '../../core/auth'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb'

const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)

// Main Lambda code
export const create = async (event: any) => {
  const jsonBody = JSON.parse(event.body)
  const userId = getUserId(event)
  await publish('services.assistant', 'content.ready', {
    content: {
      userId: userId,
      email: jsonBody.email,
      contentToGenerate: jsonBody.contentToGenerate,
      holiday: jsonBody.holiday,
      sourceMaterial: jsonBody.sourceMaterial,
      topic: jsonBody.topic
    }
  })

  // Send lambda response
  return {
    statusCode: 200,
    body: JSON.stringify('Content queued for generation.')
  }
}

export const get = async (event: any) => {
  console.log('Received event:', JSON.stringify(event, null, 2))

  var userId = getUserId(event)
  var message = 'Success'
  let body
  let statusCode = 200
  const headers = {
    'Content-Type': 'application/json'
  }

  const command = new GetCommand({
    TableName: process.env.CONTENT_GEN_TABLE,
    Key: {
      UserId: userId
    }
  })

  const response = await docClient.send(command)
  const jsonResponse = JSON.stringify(response, null, 2)
  console.log('DynamoDB response = ', jsonResponse)
  body = jsonResponse

  // Update message if userId is not in the database
  if (response.Item == null) {
    message = 'No data was found for this user!'
    console.log(message)
    statusCode = 404
  }

  return {
    statusCode,
    body,
    headers
  }
}
