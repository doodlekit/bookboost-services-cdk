import { sendEmail } from '../../mailer'
import contentGeneratedTemplate from './templates/content-generated'

export async function sendContentGeneratedEmail(content: any) {
  const toAddress = content.email
  await sendEmail(
    toAddress,
    contentGeneratedTemplate.getSubject(content),
    contentGeneratedTemplate.getTextBody(content),
    contentGeneratedTemplate.getHtmlBody(content)
  )
}
