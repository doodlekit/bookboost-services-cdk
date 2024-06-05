import { SESClient, SendEmailCommand, SendEmailCommandInput } from '@aws-sdk/client-ses' // ES Modules import
import * as AWSXray from 'aws-xray-sdk'
const client = AWSXray.captureAWSv3Client(new SESClient())

import audiobookTemplate from './new-audiobook-email'
import revisionRequestEmail from './revision-request-email'
import revisionResponseEmail from './revision-response-email'

export async function sendRevisionEmail(revision: any) {
  console.log('Sending email for revision:', revision)
  if (revision.type === 'REQUEST') {
    const toAddress = process.env.TO_EMAIL || ''
    await sendEmail(
      toAddress,
      revisionRequestEmail.getSubject(revision),
      revisionRequestEmail.getTextBody(revision),
      revisionRequestEmail.getHtmlBody(revision)
    )
  } else if (revision.type === 'RESPONSE') {
    await sendEmail(
      revision.user_email,
      revisionResponseEmail.getSubject(revision),
      revisionResponseEmail.getTextBody(revision),
      revisionResponseEmail.getHtmlBody(revision)
    )
  }
}
export async function sendAudiobookEmail(audiobook: any) {
  const toAddress = process.env.TO_EMAIL || ''
  await sendEmail(
    toAddress,
    audiobookTemplate.getSubject(audiobook),
    audiobookTemplate.getTextBody(audiobook),
    audiobookTemplate.getHtmlBody(audiobook)
  )
}

export async function sendEmail(
  toAddress: string,
  subject: string,
  textBody: string,
  htmlBody: string
) {
  const fromAddress = 'noreply@bookboost.app'
  if (!fromAddress || !toAddress) {
    throw new Error('FROM_EMAIL and TO_EMAIL environment variables are required')
  }
  console.log('To:', toAddress)
  console.log('From:', fromAddress)
  const input: SendEmailCommandInput = {
    Source: fromAddress,
    Destination: {
      ToAddresses: [toAddress]
    },
    Message: {
      Subject: {
        Data: subject
      },
      Body: {
        // Body
        Text: {
          Data: textBody
        },
        Html: {
          Data: htmlBody
        }
      }
    }
  }
  const command = new SendEmailCommand(input)
  await client.send(command)
}
