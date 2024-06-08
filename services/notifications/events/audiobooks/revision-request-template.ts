function getSubject(revision: any) {
  return `New Revision Request from ${revision.sender}`
}

function getHtmlBody(revision: any) {
  return `
    <p>${revision.sender} has requested a new revision with the following notes.</p>
    <p>${revision.notes}</p>
    <p><a href="https://${process.env.BASE_DOMAIN}/admin/users/${revision.user_id}/audiobooks">View Request</a></p>
  `
}

function getTextBody(revision: any) {
  return `
    ${revision.sender} has requested a new revision with the following notes.\n
    ${revision.notes}\n
    View Request: https://${process.env.BASE_DOMAIN}/admin/users/${revision.user_id}/audiobooks
  `
}

export default {
  getSubject,
  getHtmlBody,
  getTextBody
}
