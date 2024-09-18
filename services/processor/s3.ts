import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import axios from 'axios'
import fs from 'fs'
import path from 'path'

const jobsBucketName = process.env.JOBS_BUCKET
const jobsBucketRegion = process.env.BUCKET_REGION

async function streamUrlToS3(url: string, key: string) {
  const s3Client = new S3Client({ region: jobsBucketRegion })

  try {
    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'arraybuffer'
    })

    const tmpFilePath = path.join('/tmp', path.basename(key))
    await fs.promises.writeFile(tmpFilePath, response.data)

    console.log(`File downloaded to ${tmpFilePath}`)

    const fileStream = fs.createReadStream(tmpFilePath)

    const uploadParams = {
      Bucket: jobsBucketName,
      Key: key,
      Body: fileStream
    }

    const command = new PutObjectCommand(uploadParams)
    await s3Client.send(command)

    // Clean up the temporary file
    await fs.promises.unlink(tmpFilePath)

    return key
  } catch (error) {
    console.error('Error processing file:', error)
    throw error
  }
}

async function writeJsonToS3(json: any, key: string) {
  const s3Client = new S3Client({ region: jobsBucketRegion })

  try {
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: jobsBucketName,
        Key: key,
        Body: JSON.stringify(json),
        ContentType: 'application/json'
      }
    })

    await upload.done()

    console.log(`File uploaded successfully to ${jobsBucketName}/${key}`)
    return {
      key,
      bucket: jobsBucketName,
      region: jobsBucketRegion
    }
  } catch (error) {
    console.error('Error uploading JSON to S3:', error)
    throw error
  }
}

async function getS3Content(key: string) {
  const s3Client = new S3Client({ region: jobsBucketRegion })

  const command = new GetObjectCommand({
    Bucket: jobsBucketName,
    Key: key
  })

  const response = await s3Client.send(command)
  const text = await response.Body?.transformToString()
  return text
}

export { streamUrlToS3, writeJsonToS3, getS3Content }
