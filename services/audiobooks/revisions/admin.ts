import { getRevisions, createRevision } from './db'
import { publish } from '../../core/messages'

export async function get(event: any) {
  console.log(event)
  const userId = atob(event.pathParameters.userId)
  const audiobookId = event.pathParameters.audiobookId

  const books = await getRevisions(userId, audiobookId)

  return {
    statusCode: 200,
    body: JSON.stringify(books)
  }
}

export async function create(event: any) {
  console.log(event)
  const userId = atob(event.pathParameters.userId)
  const audiobookId = event.pathParameters.audiobookId
  console.log('audiobookId:', audiobookId)
  const body = JSON.parse(event.body)

  const record = await createRevision(userId, audiobookId, body)

  await publish('services.audiobooks', 'revision.created', {
    revision: record
  })

  return {
    statusCode: 200,
    body: JSON.stringify(record)
  }
}
