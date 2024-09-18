import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getFile, getFiles, deleteFile } from './db'

export async function list(event: any) {
  const userId = atob(event.pathParameters.userId)

  const files = await getFiles(userId)

  return {
    statusCode: 200,
    body: JSON.stringify(files)
  }
}

export async function get(event: any) {
  const userId = atob(event.pathParameters.userId)
  const fileId = event.pathParameters.fileId

  const file = await getFile(userId, fileId)

  return {
    statusCode: 200,
    body: JSON.stringify(file)
  }
}

export async function destroy(event: any) {
  const userId = atob(event.pathParameters.userId)
  const fileId = event.pathParameters.fileId

  await deleteFile(userId, fileId)

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'File deleted' })
  }
}

export async function getContents(event: any) {
  const userId = atob(event.pathParameters.userId)
  const fileId = event.pathParameters.fileId

  const file = await getFile(userId, fileId)
  if (!file) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: 'File not found' })
    }
  }

  if (!file.contents_object) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: 'Contents not found' })
    }
  }

  const contents = await getS3Content(file.contents_object)
  return {
    statusCode: 200,
    body: JSON.stringify(contents)
  }
}

export async function updateContents(event: any) {
  console.log('Updating contents:', event)
  const userId = atob(event.pathParameters.userId)
  const fileId = event.pathParameters.fileId
  const contents = JSON.parse(event.body)
  console.log('Contents:', contents)
  const file = await getFile(userId, fileId)
  if (!file) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: 'File not found' })
    }
  }

  await putS3Content(file.contents_object, contents)

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Contents updated' })
  }
}

async function getS3Content(contentsObject: any) {
  const s3Client = new S3Client({ region: contentsObject.region })

  const command = new GetObjectCommand({
    Bucket: contentsObject.bucket,
    Key: contentsObject.key
  })

  const response = await s3Client.send(command)
  const text = await response.Body?.transformToString()
  return text
}

async function putS3Content(contentsObject: any, contents: any) {
  const s3Client = new S3Client({ region: contentsObject.region })

  const command = new PutObjectCommand({
    Bucket: contentsObject.bucket,
    Key: contentsObject.key,
    Body: JSON.stringify(contents)
  })
  await s3Client.send(command)
}
