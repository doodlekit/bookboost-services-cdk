function getSubject(audiobook: any) {
  return 'New Audiobook'
}

function getHtmlBody(audiobook: any) {
  return `
    <p>A new audiobook is ready to be created.</p>
    <p><a href="https://${process.env.BASE_DOMAIN}/admin/users/${audiobook.user_id}/audiobooks">View Audiobook Request</a></p>
    <p><a href="${audiobook.transcript_url}">Download Transcript</a></p>
  `
}

function getTextBody(audiobook: any) {
  return `
    New Audiobook\n
    A new audiobook has been is ready to be created.\n
    View Audiobook Request: https://${process.env.BASE_DOMAIN}/admin/users/${audiobook.user_id}/audiobooks
    Download Transcript: ${audiobook.transcript_url}
  `
}

export default {
  getSubject,
  getHtmlBody,
  getTextBody
}
