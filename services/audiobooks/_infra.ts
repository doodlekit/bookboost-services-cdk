import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as events from 'aws-cdk-lib/aws-events'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as apigw from 'aws-cdk-lib/aws-apigateway'
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs'
import { join } from 'path'
import { createApi, addResourcefulRoutes, createQueueConsumer } from '../core/_infra'
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import { RestApi } from 'aws-cdk-lib/aws-apigateway'

interface AudiobooksProps extends cdk.StackProps {
  eventBusName: string
  domainName: string
  zoneName: string
  jwtIssuer: string
  jwtAudience: string
  fromEmail: string
  toEmail: string
  emailDomain: string
}

export class AudiobooksStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AudiobooksProps) {
    super(scope, id, props)

    // DyanmoDB table
    const audiobooksTable = new dynamodb.Table(this, 'AudiobooksTable', {
      partitionKey: { name: 'UserId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'Id', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.RETAIN
    })

    const revisionsTable = new dynamodb.Table(this, 'RevisionsTable', {
      partitionKey: { name: 'AudiobookId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'Id', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.RETAIN
    })

    // Files API Gateway
    const { api, authorizer } = createApi(
      this,
      props.zoneName,
      props.domainName,
      props.jwtIssuer,
      props.jwtAudience
    )

    // Defaults for lambda functions
    const lambdaDefaults: NodejsFunctionProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(5),
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        EVENT_BUS: props.eventBusName,
        AUDIOBOOKS_TABLE: audiobooksTable.tableName,
        REVISIONS_TABLE: revisionsTable.tableName,
        FROM_EMAIL: props.fromEmail,
        TO_EMAIL: props.toEmail,
        BASE_DOMAIN: props.emailDomain
      }
    }

    // Create CRUD routes
    const functions = addResourcefulRoutes({
      stack: this,
      api,
      authorizer,
      lambdaDefaults,
      root: 'audiobooks',
      entry: join(__dirname, 'audiobooks', 'api.ts')
    })

    const revisionsFunctions = addResourcefulRoutes({
      stack: this,
      api,
      authorizer,
      lambdaDefaults,
      root: 'audiobooks/{audiobookId}/revisions',
      entry: join(__dirname, 'revisions', 'api.ts')
    })

    const adminFunctions = setupAdminFunctions(this, lambdaDefaults, api, authorizer)

    // Get the shared event bus
    const eventBus = events.EventBus.fromEventBusName(this, 'EventBus', props.eventBusName)

    // Queue consumer
    const queueConsumerFunction = createQueueConsumer(
      this,
      lambdaDefaults,
      join(__dirname, 'consumer.ts'),
      eventBus,
      {
        'services.audiobooks': ['audio.created', 'audio.deleted', 'revision.created']
      }
    )

    // Permissions
    queueConsumerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ses:SendEmail'],
        resources: ['*'],
        effect: iam.Effect.ALLOW,
        conditions: {
          StringEquals: {
            'ses:FromAddress': props.fromEmail
          }
        }
      })
    )

    functions.map((fn) => eventBus.grantPutEventsTo(fn))
    functions.map((fn) => audiobooksTable.grantReadWriteData(fn))

    revisionsFunctions.map((fn) => revisionsTable.grantReadWriteData(fn))
    revisionsFunctions.map((fn) => eventBus.grantPutEventsTo(fn))

    adminFunctions.map((fn) => revisionsTable.grantReadWriteData(fn))
    adminFunctions.map((fn) => audiobooksTable.grantReadWriteData(fn))
    adminFunctions.map((fn) => eventBus.grantPutEventsTo(fn))

    revisionsTable.grantReadWriteData(queueConsumerFunction)
  }
}

function setupAdminFunctions(
  stack: cdk.Stack,
  lambdaDefaults: NodejsFunctionProps,
  api: RestApi,
  authorizer: any
) {
  const adminListAudiobooksFunction = new NodejsFunction(stack, 'AdminListAudiobooksFunction', {
    ...lambdaDefaults,
    entry: join(__dirname, 'audiobooks', 'admin.ts'),
    handler: 'list'
  })

  const adminUpdateAudiobookFunction = new NodejsFunction(stack, 'AdminUpdateAudiobookFunction', {
    ...lambdaDefaults,
    entry: join(__dirname, 'audiobooks', 'admin.ts'),
    handler: 'update'
  })

  const adminGetRevisionsFunction = new NodejsFunction(stack, 'AdminGetRevisionsFunction', {
    ...lambdaDefaults,
    entry: join(__dirname, 'revisions', 'admin.ts'),
    handler: 'get'
  })

  const adminCreateRevisionFunction = new NodejsFunction(stack, 'AdminCreateRevisionFunction', {
    ...lambdaDefaults,
    entry: join(__dirname, 'revisions', 'admin.ts'),
    handler: 'create'
  })

  const adminAudiobooksResource = api.root.resourceForPath('/admin/{userId}/audiobooks')
  const adminAudiobookResource = adminAudiobooksResource.addResource('{audiobookId}')
  adminAudiobooksResource.addMethod(
    'GET',
    new apigw.LambdaIntegration(adminListAudiobooksFunction),
    {}
  )
  adminAudiobookResource.addMethod(
    'PUT',
    new apigw.LambdaIntegration(adminUpdateAudiobookFunction),
    {}
  )

  const adminRevisionsResource = adminAudiobookResource.addResource('revisions')
  adminRevisionsResource.addMethod(
    'GET',
    new apigw.LambdaIntegration(adminGetRevisionsFunction),
    {}
  )
  adminRevisionsResource.addMethod(
    'POST',
    new apigw.LambdaIntegration(adminCreateRevisionFunction),
    {}
  )

  return [
    adminListAudiobooksFunction,
    adminUpdateAudiobookFunction,
    adminGetRevisionsFunction,
    adminCreateRevisionFunction
  ]
}
