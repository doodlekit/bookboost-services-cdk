import {
  getAudiobook,
  getAudiobooks,
  createAudiobook,
  updateAudiobook,
  deleteAudiobook
} from './db'

import { publish } from '../../core/messages'
import { getUserId } from '../../core/auth'

export async function list(event: any) {
  const userId = getUserId(event)

  const books = await getAudiobooks(userId)

  return {
    statusCode: 200,
    body: JSON.stringify(books)
  }
}

export async function get(event: any) {
  const id = event.pathParameters.id
  const userId = getUserId(event)

  const book = await getAudiobook(userId, id)

  return {
    statusCode: 200,
    body: JSON.stringify(book)
  }
}

export async function create(event: any) {
  const audiobook = JSON.parse(event.body)

  const userId = getUserId(event)

  const newAudiobook = await createAudiobook(userId, audiobook)

  await publish('services.audiobooks', 'audiobook.created', {
    audiobook: newAudiobook
  })

  return {
    statusCode: 201,
    body: JSON.stringify(newAudiobook)
  }
}

export async function update(event: any) {
  const id = event.pathParameters.id
  const userId = getUserId(event)
  const audiobook = JSON.parse(event.body)

  const updatedAudiobook = await updateAudiobook(userId, id, audiobook)

  await publish('services.audiobooks', 'audiobook.updated', {
    audiobook: updateAudiobook
  })

  return {
    statusCode: 200,
    body: JSON.stringify(updatedAudiobook)
  }
}

export async function destroy(event: any) {
  console.log('event', event)
  const id = event.pathParameters.id
  const userId = getUserId(event)

  await deleteAudiobook(userId, id)

  await publish('services.audiobooks', 'audiobook.deleted', {
    audiobook: {
      id
    }
  })

  return {
    statusCode: 204,
    body: ''
  }
}
