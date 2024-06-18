import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as httpapi from 'aws-cdk-lib/aws-apigatewayv2'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import * as events from 'aws-cdk-lib/aws-events'
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations'

import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs'
import { join } from 'path'

import { addRoute, createApi, createQueueConsumer } from '../core/_infra'
import { lambdaParams } from '../core/defaults'

interface ProfilesProps extends cdk.StackProps {
  environment: string
  eventBusName: string
  domainName: string
  zoneName: string
  jwtIssuer: string
  jwtAudience: string
}

export class ProfilesStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ProfilesProps) {
    super(scope, id, props)
    const auth0ClientId = ssm.StringParameter.valueForStringParameter(
      this,
      props.environment + '.AUTH0_CLIENT_ID'
    )
    const auth0ClientSecret = ssm.StringParameter.valueForStringParameter(
      this,
      props.environment + '.AUTH0_CLIENT_SECRET'
    )
    const auth0Domain = ssm.StringParameter.valueForStringParameter(
      this,
      props.environment + '.AUTH0_DOMAIN'
    )

    // Defaults for lambda functions
    const lambdaDefaults: NodejsFunctionProps = lambdaParams({
      environment: {
        EVENT_BUS: props.eventBusName,
        AUTH0_CLIENT_ID: auth0ClientId,
        AUTH0_CLIENT_SECRET: auth0ClientSecret,
        AUTH0_DOMAIN: auth0Domain
      }
    })

    // API Gateway
    const { api, authorizer } = createApi(this, {
      zoneName: props.zoneName,
      domainName: props.domainName,
      jwtIssuer: props.jwtIssuer,
      jwtAudience: props.jwtAudience
    })

    addRoute(this, api, {
      authorizer,
      lambdaDefaults,
      path: '/profile',
      method: httpapi.HttpMethod.GET,
      entry: join(__dirname, 'api.ts'),
      handler: 'get'
    })

    const updateProfileFunction = addRoute(this, api, {
      authorizer,
      lambdaDefaults,
      path: '/profile',
      method: httpapi.HttpMethod.PUT,
      entry: join(__dirname, 'api.ts'),
      handler: 'update'
    })

    addRoute(this, api, {
      authorizer,
      lambdaDefaults,
      path: '/profile/send-verification-email',
      method: httpapi.HttpMethod.POST,
      entry: join(__dirname, 'api.ts'),
      handler: 'sendVerificationEmail'
    })

    // Get the shared event bus
    const eventBus = events.EventBus.fromEventBusName(this, 'EventBus', props.eventBusName)

    // Queue consumer
    const queueConsumerFunction = createQueueConsumer(this, {
      lambdaDefaults: { ...lambdaDefaults, timeout: cdk.Duration.seconds(30), memorySize: 512 },
      entry: join(__dirname, 'consumer.ts'),
      eventBus,
      sources: {
        'services.stripe': ['subscription.created']
      }
    })

    eventBus.grantPutEventsTo(queueConsumerFunction)
    eventBus.grantPutEventsTo(updateProfileFunction)
  }
}
