import { v4 as uuidv4 } from 'uuid'
import {
  CreateScheduleCommand,
  FlexibleTimeWindowMode,
  SchedulerClient,
  CreateScheduleCommandInput,
  DeleteScheduleCommand
} from '@aws-sdk/client-scheduler'

import * as AWSXray from 'aws-xray-sdk'
const schedulerClient = AWSXray.captureAWSv3Client(new SchedulerClient({}))
const schedulerFunctionArn = process.env.SCHEDULE_FUNCTION_ARN
const schedulerRoleArn = process.env.SCHEDULE_ROLE_ARN

export async function createSchedule(schedule: any) {
  const id = uuidv4()
  console.log(`Creating schedule with id: ${id}`)
  console.log('Role Arn: ', schedulerRoleArn)
  console.log('Function Arn: ', schedulerFunctionArn)

  const schedulerParams: CreateScheduleCommandInput = {
    Name: `autogen-${id}`,
    Description: 'Scheduled content generation',
    ScheduleExpression: `cron(${schedule.cronExpression})`,
    ScheduleExpressionTimezone: schedule.cronTimeZone,
    Target: {
      Input: JSON.stringify(schedule),
      Arn: schedulerFunctionArn,
      RoleArn: schedulerRoleArn
    },
    FlexibleTimeWindow: { Mode: FlexibleTimeWindowMode.OFF }
  }
  return schedulerClient.send(new CreateScheduleCommand(schedulerParams))
}

export async function deleteSchedule(scheduleArn: string) {
  const deleteScheduleCommand = new DeleteScheduleCommand({ Name: scheduleArn })
  await schedulerClient.send(deleteScheduleCommand)
}
