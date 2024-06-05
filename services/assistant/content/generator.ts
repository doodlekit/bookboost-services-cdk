import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocument,
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand
} from '@aws-sdk/lib-dynamodb'
import OpenAI from 'openai'

import * as AWSXray from 'aws-xray-sdk'
const client = AWSXray.captureAWSv3Client(new DynamoDBClient())
const dynamo = DynamoDBDocument.from(client)
const docClient = DynamoDBDocumentClient.from(client)
const openai = new OpenAI()
const assistansTableName = process.env.ASSISTANTS_TABLE

// Main Lambda code
export const generate = async (jsonBody: any) => {
  // - Determine the contentToGenerate, sourceMaterial, and assistantId
  let userId = jsonBody.userId
  let contentToGenerate = jsonBody.contentToGenerate
  let sourceMaterial = jsonBody.sourceMaterial
  let topic = jsonBody.topic
  const records = await dynamo.send(
    new QueryCommand({
      TableName: assistansTableName,
      KeyConditionExpression: 'UserId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    })
  )
  console.log('Records:', records)
  if (!records.Items || records.Items.length === 0) {
    console.error('Could not find Assistant!')
    return null
  }
  let assistantId = records.Items[0].OpenAiAssistantId
  console.log('Got Assistant = ', assistantId)
  // ^^^^ Later we'll need to update this when we have multiple assistants per user
  // It will need to select the Assistant based on the userId + sourceMaterial

  // - Parse Holiday text
  // SKIP this logic for now, as it's not implemented in the front end yet

  // - Gather the prompt components from Dynamo based on contentType
  console.log('Prompt table = ', process.env.PROMPT_TABLE)
  console.log('Prompt contentType = ', contentToGenerate)
  console.log('Source material = ', sourceMaterial)
  let promptTableResponse
  try {
    const promptCommand = new GetCommand({
      TableName: process.env.PROMPT_TABLE,
      Key: {
        ContentType: contentToGenerate
      }
    })

    promptTableResponse = await docClient.send(promptCommand)
    console.log('Prompt table response = ', promptTableResponse)
  } catch (err) {
    console.error('Could not find contentType in Prompt Table!', err)
  }

  if (!promptTableResponse?.Item) {
    throw new Error('Could not find contentType in Prompt Table!')
  }
  // - Compile prompt into one string for OpenAI
  let fullPrompt = `${promptTableResponse.Item.PromptStart}
Content: ${promptTableResponse.Item.ContentType}
Goal: ${promptTableResponse.Item.Goal}
Context: ${promptTableResponse.Item.Context}
Constraints: ${promptTableResponse.Item.Constraints}
Target Audience: ${promptTableResponse.Item.TargetAudience}
Tone: ${promptTableResponse.Item.Tone}
Length: ${promptTableResponse.Item.Length}
Output Format: ${promptTableResponse.Item.OutputFormat}
Source Material: ${sourceMaterial}`

  if (topic) {
    fullPrompt += `\nTopic: ${topic}`
  }
  console.log('Full prompt to OpenAI Assistant: ', fullPrompt)

  // - Send prompt to Assistant and await response
  const openAiThread = await openai.beta.threads.create()
  let threadId = openAiThread.id
  await openai.beta.threads.messages.create(threadId, { role: 'user', content: fullPrompt })
  let assistantResponse = ''
  const stream = await openai.beta.threads.runs
    .stream(threadId, {
      assistant_id: assistantId
    })
    .on('event', async (event) => {
      if (event.event == 'thread.message.delta') {
        const content: any = event.data.delta.content
        if (!content) {
          return
        }

        assistantResponse = assistantResponse + content[0].text.value
      }
    })
  await stream.finalRun()
  console.log('Assistant Response = ', assistantResponse)

  // - Capture timestamp and organize data for storage
  const date = new Date()
  let lastUpdated = date.toISOString()
  let textContent = assistantResponse // UPDATE to get from open ai
  let fileContent = '' // empty for now, to be used with image generation

  // - Store/update content in DynamoDB
  const addUserContent = {
    Item: {
      UserId: userId,
      ContentType: contentToGenerate,
      LastUpdated: lastUpdated,
      TextContent: textContent,
      FileContent: fileContent
    },
    TableName: process.env.CONTENT_GEN_TABLE
  }

  await dynamo.put(addUserContent)
  console.log('Added content to DB = ', addUserContent)

  // Send lambda response
  return textContent
}
