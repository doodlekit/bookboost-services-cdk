function getSubject(revision: any) {
  return `New Revision from ${revision.sender}`
}

function getHtmlBody(revision: any) {
  return `
    <p>${revision.sender} has submitted a new revision with the following notes.</p>
    <p>${revision.notes}</p>
    <p><a href="https://${process.env.BASE_DOMAIN}/audiobooks">View Revision</a></p>
  `
}

function getTextBody(revision: any) {
  return `
    ${revision.sender} has submitted a new revision with the following notes.\n
    ${revision.notes}\n
    View Revision: https://${process.env.BASE_DOMAIN}/audiobooks
  `
}

export default {
  getSubject,
  getHtmlBody,
  getTextBody
}
