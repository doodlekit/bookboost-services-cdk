function getSubject(audiobook: any) {
  return 'Your Audiobook is Ready'
}

function getHtmlBody(audiobook: any) {
  return `
    <p>Your finalized Audiobook is Ready!</p>
    <p><a href="https://${process.env.BASE_DOMAIN}/audiobooks/${audiobook.id}/final">View Audiobook</a></p>
  `
}

function getTextBody(audiobook: any) {
  return `
    Your finalized Audiobook is Ready!
    https://${process.env.BASE_DOMAIN}/audiobooks/${audiobook.id}/final
  `
}

function getSmsBody(audiobook: any) {
  return `Your audiobook is ready: https://${process.env.BASE_DOMAIN}/audiobooks/${audiobook.id}/final`
}

export default {
  getSmsBody,
  getSubject,
  getHtmlBody,
  getTextBody
}
