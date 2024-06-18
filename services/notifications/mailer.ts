import { SESClient, SendEmailCommand, SendEmailCommandInput } from '@aws-sdk/client-ses' // ES Modules import
import * as AWSXray from 'aws-xray-sdk'
const client = AWSXray.captureAWSv3Client(new SESClient())

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
