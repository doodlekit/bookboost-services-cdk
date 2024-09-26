import axios from 'axios'
const convertApiKey = process.env.CONVERT_API_KEY || ''
const convertApiUrl = 'https://v2.convertapi.com'
const baseUrl = process.env.BASE_URL
async function docToText(userId: string, jobId: string, doc: any): Promise<any> {
  // Get the file extension from the file name
  const fileExtension = doc.file_name.split('.').pop().toLowerCase()

  const response = await axios.post(
    `${convertApiUrl}/async/convert/${fileExtension}/to/txt?Secret=${convertApiKey}&StoreFile=true&RemoveHeadersFooters=true&File=${doc.url}&WebHook=${baseUrl}&Timeout=1200/convert/callback/${userId}/${jobId}`
  )
  console.log('response', response)
  if (response.status !== 200) {
    throw new Error('Failed to start document conversion')
  }
  const conversionJobId = response.data.JobId
  return conversionJobId
}

async function getConversionStatus(jobId: string) {
  const response = await axios.get(`${convertApiUrl}/async/job/${jobId}`)
  console.log('response', response)
  if (response.status !== 200) {
    throw new Error('Failed to get document conversion status')
  }
  return response.data
}
export { docToText, getConversionStatus }
