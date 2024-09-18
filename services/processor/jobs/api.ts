import { APIGatewayEvent } from 'aws-lambda'
import { publish } from '../../core/messages'
import { createJob, getJob, updateJob } from './db'
import { getConversionStatus } from '../convert'
import { streamUrlToS3 } from '../s3'

export async function webhook(event: APIGatewayEvent) {
  const userId = event.pathParameters?.userId
  const jobId = event.pathParameters?.jobId
  if (!userId || !jobId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Job ID is required' })
    }
  }

  if (!event.body) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Body is required' })
    }
  }
  const body = JSON.parse(event.body)
  console.log('Body:', body)
  const convertJobId = body.JobId
  const status = await getConversionStatus(convertJobId)
  console.log('Status:', status)

  const convertedFile = status.Files[0]
  const key = `${userId}/${jobId}/${convertedFile.FileName}`
  const outputKey = await streamUrlToS3(convertedFile.Url, key)

  await updateJob(userId, jobId, {
    status: 'CONVERTED',
    converted_file: {
      key: outputKey,
      file_name: convertedFile.FileName,
      file_size: convertedFile.FileSize
    }
  })
  const job = await getJob(userId, jobId)

  await publish('services.processor', 'job.converted', {
    job
  })

  return {
    statusCode: 200,
    body: JSON.stringify(job)
  }
}
