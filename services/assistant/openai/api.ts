import OpenAI from 'openai'
const openai = new OpenAI()
import { getUserId } from '../../core/auth'
import { APIGatewayEvent } from 'aws-lambda'

export async function createAssistant(event: APIGatewayEvent) {
  const userId = getUserId(event)

  // // const assistant = await openai.beta.assistants.create({
  // // })

  // console.log('Assistant:', assistant)

  // return {
  //   statusCode: 200,
  //   body: JSON.stringify(assistant)
  // }
}
