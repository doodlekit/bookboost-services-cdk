import { createAutogen, getAllAutogens, getAutogen, deleteAutogen } from './db'
import { createSchedule, deleteSchedule } from './scheduler'
import { getUserId } from '../../core/auth'

export async function create(event: any) {
  console.log('Event:', event)
  const body = JSON.parse(event.body)
  console.log(process.env.ROLE_STRING)

  try {
    const schedule = await createSchedule(body)
    await createAutogen({
      ...body,
      schedulerArn: schedule.ScheduleArn
    })

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'User added successfully!' }),
      headers: { 'Content-Type': 'application/json' }
    }
  } catch (error) {
    console.error('Error adding user:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to add user' }),
      headers: { 'Content-Type': 'application/json' }
    }
  }
}

export async function list(event: any) {
  const userId = getUserId(event)
  const autogens = await getAllAutogens(userId)
  return {
    statusCode: 200,
    body: JSON.stringify(autogens),
    headers: { 'Content-Type': 'application/json' }
  }
}

export async function destroy(event: any) {
  const userId = getUserId(event)
  const id = event.pathParameters.id
  const autogen = await getAutogen(userId, id)
  const scheduleName = autogen.scheduler_arn.split('/').pop()

  try {
    await deleteSchedule(scheduleName)
  } catch (error: any) {
    // If the schedule doesn't exist, we can ignore the error
    if (error.name !== 'ResourceNotFoundException') {
      console.error('Error deleting schedule:', error)
      throw error
    } else {
      console.log('Schedule not found:', scheduleName)
    }
  }

  await deleteAutogen(userId, id)
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Schedule removed successfully!' }),
    headers: { 'Content-Type': 'application/json' }
  }
}
