import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as events from 'aws-cdk-lib/aws-events'
import * as httpapi from 'aws-cdk-lib/aws-apigatewayv2'
import { NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import { join } from 'path'
import { createApi, createQueueConsumer, addRoute } from '../core/_infra'

interface ProcessorProps extends cdk.StackProps {
  eventBusName: string
  domainName: string
  zoneName: string
  jwtIssuer: string
  jwtAudience: string
  environment: string
}

export class ProcessorStack extends cdk.Stack {
  public readonly jobsBucket: s3.Bucket

  constructor(scope: Construct, id: string, props: ProcessorProps) {
    super(scope, id, props)

    // DynamoDB table for jobs
    const jobsTable = new dynamodb.Table(this, 'JobsTable', {
      partitionKey: { name: 'UserId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'Id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN
    })
    const partsTable = new dynamodb.Table(this, 'PartsTable', {
      partitionKey: { name: 'JobId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'Id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN
    })

    this.jobsBucket = this.createBucket(props)

    // Create API
    const { api, authorizer } = createApi(this, {
      zoneName: props.zoneName,
      domainName: props.domainName,
      jwtIssuer: props.jwtIssuer,
      jwtAudience: props.jwtAudience
    })

    // Lambda function defaults
    const lambdaDefaults: NodejsFunctionProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(900),
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        EVENT_BUS: props.eventBusName,
        JOBS_TABLE: jobsTable.tableName,
        PARTS_TABLE: partsTable.tableName,
        GOOGLE_API_KEY: ssm.StringParameter.valueForStringParameter(
          this,
          props.environment + '.GOOGLE_API_KEY'
        ),
        CONVERT_API_KEY: ssm.StringParameter.valueForStringParameter(
          this,
          props.environment + '.CONVERT_API_KEY'
        ),
        ANTHROPIC_API_KEY: ssm.StringParameter.valueForStringParameter(
          this,
          props.environment + '.ANTHROPIC_API_KEY'
        ),
        JOBS_BUCKET: this.jobsBucket.bucketName,
        BUCKET_REGION: this.region,
        BASE_URL: `https://${props.domainName}`
      },
      bundling: {
        sourceMap: true,
        minify: true
      }
    }

    const adminCreateJobFunction = addRoute(this, api, {
      authorizer,
      authorizationScopes: ['manage:users'],
      lambdaDefaults,
      path: '/admin/{userId}/jobs',
      method: httpapi.HttpMethod.POST,
      entry: join(__dirname, 'jobs', 'admin.ts'),
      handler: 'create'
    })

    const adminGetJobFunction = addRoute(this, api, {
      authorizer,
      authorizationScopes: ['manage:users'],
      lambdaDefaults,
      path: '/admin/{userId}/jobs/{jobId}',
      method: httpapi.HttpMethod.GET,
      entry: join(__dirname, 'jobs', 'admin.ts'),
      handler: 'get'
    })
    const convertorWebhookFunction = addRoute(this, api, {
      lambdaDefaults,
      path: '/convert/callback/{userId}/{jobId}',
      method: httpapi.HttpMethod.POST,
      entry: join(__dirname, 'jobs', 'api.ts'),
      handler: 'webhook'
    })

    const eventBus = events.EventBus.fromEventBusName(this, 'EventBus', props.eventBusName)
    const queueConsumerFunction = createQueueConsumer(this, {
      lambdaDefaults,
      entry: join(__dirname, 'consumer.ts'),
      eventBus,
      sources: {
        'services.processor': [
          'job.created',
          'job.converted',
          'job.processed',
          'job.evaluated',
          'job.extracted',
          'part.created'
        ]
      }
    })
    eventBus.grantPutEventsTo(queueConsumerFunction)
    eventBus.grantPutEventsTo(adminCreateJobFunction)
    jobsTable.grantReadWriteData(adminCreateJobFunction)
    jobsTable.grantReadWriteData(queueConsumerFunction)
    jobsTable.grantReadWriteData(adminGetJobFunction)
    eventBus.grantPutEventsTo(convertorWebhookFunction)
    jobsTable.grantReadWriteData(convertorWebhookFunction)
    partsTable.grantReadWriteData(queueConsumerFunction)
    this.jobsBucket.grantReadWrite(queueConsumerFunction)
    this.jobsBucket.grantReadWrite(convertorWebhookFunction)
  }

  private createBucket(props: ProcessorProps) {
    const jobsBucket = new s3.Bucket(this, 'JobsBucket', {
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
          allowedOrigins: ['*'],
          allowedHeaders: ['*']
        }
      ]
    })
    return jobsBucket
  }
}
