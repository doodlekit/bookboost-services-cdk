import Twilio from 'twilio'

export const sendMessage = async (to: string, body: string) => {
  console.log('TWILIO_SID', process.env.TWILIO_SID)
  console.log('TWILIO_TOKEN', process.env.TWILIO_TOKEN)
  const twilioClient = Twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN)
  const twilioNumber = process.env.TWILIO_NUMBER

  console.log('Sending SMS', to)
  await twilioClient.messages.create({
    to,
    from: twilioNumber,
    body
  })
}
