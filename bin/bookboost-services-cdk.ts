#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { BusStack } from '../services/bus/_infra'
import { FilesStack } from '../services/files/_infra'
import { AssistantStack } from '../services/assistant/_infra'
import { AdminStack } from '../services/admin/_infra'
import { ProfilesStack } from '../services/profiles/_infra'
import { StripeStack } from '../services/stripe/_infra'
import { NotificationsStack } from '../services/notifications/_infra'
import { AudiobooksStack } from '../services/audiobooks/_infra'

const app = new cdk.App()
const environment = app.node.tryGetContext('env') || 'dev'
const busStack = new BusStack(app, `${environment}-BusStack`)
const zoneName = 'bookboost.app'
const domainRoot = environment === 'prod' ? zoneName : `${environment}.${zoneName}`
const defaultProps = {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  },
  eventBusName: busStack.eventBusName,
  zoneName: zoneName,
  jwtIssuer: 'https://auth.bookboost.app/',
  jwtAudience: 'https://a8sh3eh6pj.execute-api.us-east-2.amazonaws.com'
}
new FilesStack(app, `${environment}-FilesStack`, {
  ...defaultProps,
  domainName: 'files.api.' + domainRoot,
  assetsDomainName: 'assets.' + domainRoot,
  filesBucketName: environment + '-bookboost-services-files'
})
new AssistantStack(app, `${environment}-AssistantStack`, {
  ...defaultProps,
  domainName: 'assistant.api.' + domainRoot
})
new AdminStack(app, `${environment}-AdminStack`, {
  ...defaultProps,
  domainName: 'admin.api.' + domainRoot
})
new ProfilesStack(app, `${environment}-ProfilesStack`, {
  ...defaultProps,
  domainName: 'profiles.api.' + domainRoot
})
new StripeStack(app, `${environment}-StripeStack`, {
  ...defaultProps,
  domainName: 'billing.api.' + domainRoot
})
new NotificationsStack(app, `${environment}-NotificationsStack`, {
  ...defaultProps,
  domainName: 'notifications.api.' + domainRoot,
  fromEmail: `noreply@${zoneName}`,
  emailDomain: zoneName,
  toEmail: 'ben@doodlekit.com'
})
new AudiobooksStack(app, `${environment}-AudiobooksStack`, {
  ...defaultProps,
  domainName: 'audiobooks.api.' + domainRoot,
  fromEmail: `noreply@${zoneName}`,
  emailDomain: zoneName,
  toEmail: 'ben@doodlekit.com'
})
