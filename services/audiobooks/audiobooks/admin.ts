import { getAudiobook, getAudiobooks, updateAudiobook, deleteAudiobook } from './db'
import { createChapter, deleteChapters, getChapters } from '../chapters/db'

export async function list(event: any) {
  const userId = atob(event.pathParameters.userId)

  const books = await getAudiobooks(userId)

  return {
    statusCode: 200,
    body: JSON.stringify(books)
  }
}

export async function get(event: any) {
  const userId = atob(event.pathParameters.userId)
  const bookId = event.pathParameters.audiobookId

  const book = await getAudiobook(userId, bookId)
  const chapters = await getChapters(bookId)
  book.chapters = chapters

  return {
    statusCode: 200,
    body: JSON.stringify(book)
  }
}

export async function update(event: any) {
  console.log(event)
  const userId = atob(event.pathParameters.userId)
  const bookId = event.pathParameters.audiobookId
  const body = JSON.parse(event.body)

  await updateAudiobook(userId, bookId, body)
  await updateChapters(userId, body)

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Audiobook updated' })
  }
}

async function updateChapters(userId: string, audiobook: any) {
  const chapters = audiobook.chapters || []
  const audiobookId = audiobook.id

  await deleteChapters(audiobookId)

  const promises = chapters.map((chapter: any) => {
    return createChapter(userId, audiobookId, chapter)
  })

  return Promise.all(promises)
}

export async function destroy(event: any) {
  const userId = atob(event.pathParameters.userId)
  const bookId = event.pathParameters.audiobookId

  await deleteAudiobook(userId, bookId)

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Audiobook deleted' })
  }
}
