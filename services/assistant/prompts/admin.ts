import { getPrompts, updatePrompt } from './db'

export async function list(event: any) {
  const records = await getPrompts()

  return {
    statusCode: 200,
    body: JSON.stringify(records)
  }
}

export async function update(event: any) {
  console.log(event)
  const body = JSON.parse(event.body)
  const contentType = body.content_type

  await updatePrompt(contentType, body)

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Prompt updated' })
  }
}
