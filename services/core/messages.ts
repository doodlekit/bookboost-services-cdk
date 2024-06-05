import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge'
import * as AWSXray from 'aws-xray-sdk'
const client = AWSXray.captureAWSv3Client(new EventBridgeClient({}))

export const publish = async (source: string, type: string, message: any) => {
  const response = await client.send(
    new PutEventsCommand({
      Entries: [
        {
          EventBusName: process.env.EVENT_BUS,
          Detail: JSON.stringify(message),
          DetailType: type,
          Source: source
        }
      ]
    })
  )
  console.log(response)
  return response
}
