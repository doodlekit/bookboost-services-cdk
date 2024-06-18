import { publish } from '../../core/messages'
import { generate } from '../content/generator'

export async function handler(event: any): Promise<{ statusCode: number; body: string }> {
  console.log('Event: ', event)

  try {
    console.log('Input to generate content: ', event)
    const contentGenerated = await generate(event)
    console.log('Here is the generated content: ', contentGenerated)
    await publish('services.assistant', 'scheduled.content.generated', {
      content: {
        user_id: event.userId,
        email: event.email,
        content_type: event.contentToGenerate,
        text_content: contentGenerated
      }
    })

    return { statusCode: 200, body: JSON.stringify({ message: 'Emails sent successfully!' }) }
  } catch (error) {
    console.error('Error processing event:', error)
    return { statusCode: 500, body: JSON.stringify({ message: 'Failed to process event' }) }
  }
}
