import { EventBridgeEvent } from 'aws-lambda/trigger/eventbridge'

import { docToText } from './convert'
import { getJob, updateJob } from './jobs/db'
import { publish } from '../core/messages'
import { evaluateExtraction, postProcessChapter, processManuscriptFromS3 } from './extract'
import { getS3Content, writeJsonToS3 } from './s3'
import { createPart, getPart, getParts, updatePart } from './parts/db'

export const handler = async (event: EventBridgeEvent<any, any>) => {
  console.log('Event:', event)
  const message = event.detail
  const type = event['detail-type']
  switch (type) {
    case 'job.created':
      return await onJobCreated(message.job)
    case 'job.converted':
      return await onJobConverted(message.job)
    case 'job.extracted':
      return await onJobExtracted(message.job)
    case 'job.processed':
      return await onJobProcessed(message.job)
    case 'job.evaluated':
      return await onJobEvaluated(message.job)
    case 'part.created':
      return await onPartCreated(message)
    default:
      return {
        body: 'Method Not Allowed'
      }
  }
}

async function onJobCreated(job: any) {
  console.log('Job created:', job)

  try {
    const conversionJobId = await docToText(job.user_id, job.id, job.file)
    await updateJob(job.user_id, job.id, {
      status: 'CONVERTING',
      conversion_job_id: conversionJobId
    })
  } catch (error: any) {
    console.error('Error updating job:', error)
    await updateJob(job.user_id, job.id, {
      status: 'FAILED',
      last_error: error.message
    })
    throw error
  }
}

async function onJobConverted(job: any) {
  console.log('Job converted:', job)

  try {
    await updateJob(job.user_id, job.id, {
      status: 'EXTRACTING'
    })

    const { chapters } = await processManuscriptFromS3(job.converted_file.key)
    console.log('Chapters:', chapters)

    const chaptersObject = await writeJsonToS3(chapters, `${job.user_id}/${job.id}/chapters.json`)

    await updateJob(job.user_id, job.id, {
      status: 'EXTRACTED',
      chapters_object: chaptersObject
    })

    const updatedJob = await getJob(job.user_id, job.id)

    await publish('services.processor', 'job.extracted', {
      job: updatedJob
    })
  } catch (error: any) {
    console.error('Error processing converted job:', error)
    await updateJob(job.user_id, job.id, {
      status: 'FAILED',
      last_error: error.message
    })
    throw error
  }
}

async function onJobExtracted(job: any) {
  console.log('Job extracted:', job)

  try {
    await updateJob(job.user_id, job.id, {
      status: 'PROCESSING'
    })

    const fileContent = await getS3Content(job.chapters_object.key)
    if (!fileContent) {
      throw new Error('File content is undefined')
    }
    const chapters = JSON.parse(fileContent)

    // Trigger chapter processing events
    for (let i = 0; i < chapters.length; i++) {
      const part = {
        contents: chapters[i],
        processed: false,
        order: i
      }
      const newPart = await createPart(job.id, part)

      await publish('services.processor', 'part.created', {
        user_id: job.user_id,
        job_id: job.id,
        part: newPart
      })
    }

    // We'll update the job status to PROCESSED after all chapters are processed
    // This will be handled in the onChapterProcessing function
  } catch (error: any) {
    console.error('Error processing extracted job:', error)
    await updateJob(job.user_id, job.id, {
      status: 'FAILED',
      last_error: error.message
    })
    throw error
  }
}

async function onPartCreated(message: any) {
  console.log('Processing part:', message)

  const userId = message.user_id
  const jobId = message.job_id
  const partId = message.part.id

  // Retrieve the job and chapter content
  const job = await getJob(userId, jobId)
  const part = await getPart(jobId, partId)
  console.log('Part:', part)
  try {
    if (!part) {
      throw new Error('Part not found')
    }

    // Post-process the chapter
    const processedChapter = await postProcessChapter(part.contents)
    await updatePart(jobId, partId, {
      processed: true,
      contents: processedChapter
    })

    const parts = await getParts(jobId)
    if (!parts) {
      throw new Error('Parts not found')
    }

    // Check if all chapters are processed
    const allChaptersProcessed = parts.every((part: any) => part.processed)

    if (allChaptersProcessed) {
      await assembleChapters(job)

      const updatedJob = await getJob(userId, jobId)

      await publish('services.processor', 'job.processed', {
        job: updatedJob
      })
    }
  } catch (error: any) {
    console.error('Error processing chapter:', error)
    await updatePart(jobId, partId, {
      processed: true,
      error: error.message
    })
    throw error
  }
}

async function assembleChapters(job: any) {
  console.log('Assembling chapters for job:', job)

  const parts = await getParts(job.id)
  if (!parts) {
    throw new Error('Parts not found')
  }

  const chapters = parts
    .sort((a: any, b: any) => a.order - b.order)
    .map((part: any) => part.contents)

  const chaptersContent = await writeJsonToS3(chapters, `${job.user_id}/${job.id}/chapters.json`)
  await updateJob(job.user_id, job.id, {
    status: 'PROCESSED',
    chapters_object: chaptersContent
  })
}

async function onJobProcessed(job: any) {
  console.log('Job processed:', job)

  try {
    await updateJob(job.user_id, job.id, {
      status: 'EVALUATING'
    })

    const fileContent = await getS3Content(job.converted_file.key)
    if (!fileContent) {
      throw new Error('File content is undefined')
    }
    const chaptersContent = await getS3Content(job.chapters_object.key)
    if (!chaptersContent) {
      throw new Error('Chapters content is undefined')
    }
    const chapters = JSON.parse(chaptersContent)
    const evaluation = await evaluateExtraction(chapters, fileContent)

    await updateJob(job.user_id, job.id, {
      status: 'EVALUATED',
      extraction_evaluation: evaluation
    })

    const updatedJob = await getJob(job.user_id, job.id)

    await publish('services.processor', 'job.evaluated', {
      job: updatedJob
    })
  } catch (error: any) {
    console.error('Error processing evaluated job:', error)
    await updateJob(job.user_id, job.id, {
      status: 'FAILED',
      last_error: error.message
    })
    throw error
  }
}

async function onJobEvaluated(job: any) {
  console.log('Job evaluated:', job)

  await updateJob(job.user_id, job.id, {
    status: 'COMPLETED'
  })

  const updatedJob = await getJob(job.user_id, job.id)

  await publish('services.processor', 'job.completed', {
    job: updatedJob
  })
}
