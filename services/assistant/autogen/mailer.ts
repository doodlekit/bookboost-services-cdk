import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import { generate } from '../content/generator'
// @ts-ignore
import { markdown } from 'markdown'

import * as AWSXray from 'aws-xray-sdk'
const sesClient = AWSXray.captureAWSv3Client(new SESClient({}))

export async function handler(event: any): Promise<{ statusCode: number; body: string }> {
  console.log('Event: ', event)

  try {
    const generateContent = event
    console.log('Input to generate content: ', generateContent)
    const contentGenerated = await generate(generateContent)
    console.log('Here is the generated content: ', contentGenerated)
    await sendEmail(
      generateContent.email,
      generateContent.contentToGenerate,
      contentGenerated || ''
    )

    return { statusCode: 200, body: JSON.stringify({ message: 'Emails sent successfully!' }) }
  } catch (error) {
    console.error('Error processing event:', error)
    return { statusCode: 500, body: JSON.stringify({ message: 'Failed to process event' }) }
  }
}

async function sendEmail(
  emailAddress: string,
  contentType: string,
  content: string
): Promise<void> {
  const fromAddress = 'noreply@bookboost.app'
  const htmlContent = markdown.toHTML(content)
  const emailParams = {
    Source: fromAddress,
    Destination: {
      ToAddresses: [emailAddress]
    },
    Message: {
      Body: {
        Text: { Data: content },
        Html: { Data: htmlContent }
      },
      Subject: { Data: "BookBoost - Your Book's Auto-Generated Content - " + contentType }
    }
  }

  try {
    await sesClient.send(new SendEmailCommand(emailParams))
    console.log(`Email sent to ${emailAddress}`)
  } catch (error) {
    console.error(`Failed to send email to ${emailAddress}`, error)
  }
}
