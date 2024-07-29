import { sendEmail } from '../../mailer'
import audiobookTemplate from './templates/new-audiobook'
import revisionRequestEmail from './templates/revision-request'
import revisionResponseEmail from './templates/revision-response'

export async function sendRevisionEmail(profile: any, revision: any) {
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
      profile.email,
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
