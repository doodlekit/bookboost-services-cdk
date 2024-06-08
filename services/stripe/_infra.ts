import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as httpapi from 'aws-cdk-lib/aws-apigatewayv2'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import * as events from 'aws-cdk-lib/aws-events'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations'

import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs'
import { join } from 'path'

import { addRoute, createApi } from '../core/_infra'

interface StripeProps extends cdk.StackProps {
  eventBusName: string
  domainName: string
  zoneName: string
  jwtIssuer: string
  jwtAudience: string
}

export class StripeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: StripeProps) {
    super(scope, id, props)
    const stripeSecretKey = ssm.StringParameter.valueForStringParameter(
      this,
      'Prod.STRIPE_SECRET_KEY'
    )
    const stripeEndpointSecret = ssm.StringParameter.valueForStringParameter(
      this,
      'Prod.STRIPE_ENDPOINT_SECRET'
    )

    const subscriptionsTable = new dynamodb.Table(this, 'SubscriptionsTable', {
      partitionKey: { name: 'UserId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'Id', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.RETAIN
    })

    // API Gateway
    const { api, authorizer } = createApi(this, {
      zoneName: props.zoneName,
      domainName: props.domainName,
      jwtIssuer: props.jwtIssuer,
      jwtAudience: props.jwtAudience
    })

    // Defaults for lambda functions
    const lambdaDefaults: NodejsFunctionProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(5),
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        EVENT_BUS: props.eventBusName,
        SUBSCRIPTIONS_TABLE: subscriptionsTable.tableName,
        STRIPE_SECRET_KEY: stripeSecretKey,
        STRIPE_ENDPOINT_SECRET: stripeEndpointSecret
      }
    }

    const webhookFunction = new NodejsFunction(this, 'WebhookFunction', {
      ...lambdaDefaults,
      entry: join(__dirname, 'webhook.ts'),
      handler: 'handler'
    })

    api.addRoutes({
      path: '/webhoook',
      methods: [httpapi.HttpMethod.POST],
      integration: new HttpLambdaIntegration('WebhookFunctionIntegration', webhookFunction)
    })

    const createPortalSessionFunction = addRoute(this, api, {
      authorizer,
      lambdaDefaults,
      path: '/portal/session',
      method: httpapi.HttpMethod.POST,
      entry: join(__dirname, 'api.ts'),
      handler: 'createPortalSession'
    })

    const getSubscriptionFunction = addRoute(this, api, {
      authorizer,
      lambdaDefaults,
      path: '/subscription',
      method: httpapi.HttpMethod.POST,
      entry: join(__dirname, 'api.ts'),
      handler: 'createSubscription'
    })

    subscriptionsTable.grantReadWriteData(getSubscriptionFunction)
    subscriptionsTable.grantReadWriteData(createPortalSessionFunction)
    subscriptionsTable.grantReadWriteData(webhookFunction)

    // Get the shared event bus
    const eventBus = events.EventBus.fromEventBusName(this, 'EventBus', props.eventBusName)
    eventBus.grantPutEventsTo(webhookFunction)
  }
}
