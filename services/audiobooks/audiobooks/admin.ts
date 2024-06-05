import { getAudiobooks, updateAudiobook } from './db'

export async function list(event: any) {
  const userId = atob(event.pathParameters.userId)

  const books = await getAudiobooks(userId)

  return {
    statusCode: 200,
    body: JSON.stringify(books)
  }
}

export async function update(event: any) {
  console.log(event)
  const userId = atob(event.pathParameters.userId)
  console.log('User Id:', userId)
  const bookId = event.pathParameters.audiobookId
  console.log('Book Id:', bookId)
  const body = JSON.parse(event.body)

  await updateAudiobook(userId, bookId, body)

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Audiobook updated' })
  }
}
