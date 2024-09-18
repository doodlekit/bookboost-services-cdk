import { APIGatewayEvent } from 'aws-lambda'
import { publish } from '../../core/messages'
import { createJob, getJob } from './db'

export async function create(event: APIGatewayEvent) {
  console.log('create', event)
  const userId = atob(event.pathParameters?.userId || '')

  const body = JSON.parse(event.body || '{}')

  const job = {
    file: body.file
  }
  console.log('job', job)

  const newJob = await createJob(userId, job)

  await publish('services.processor', 'job.created', {
    job: newJob
  })

  return {
    statusCode: 200,
    body: JSON.stringify(newJob)
  }
}

export async function get(event: APIGatewayEvent) {
  console.log('getJob', event)
  const userId = atob(event.pathParameters?.userId || '')
  const jobId = event.pathParameters?.jobId || ''

  const job = await getJob(userId, jobId)
  return {
    statusCode: 200,
    body: JSON.stringify(job)
  }
}
