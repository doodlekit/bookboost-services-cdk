import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as cm from 'aws-cdk-lib/aws-certificatemanager'
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as httpapi from 'aws-cdk-lib/aws-apigatewayv2'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as events from 'aws-cdk-lib/aws-events'
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs'
import { join } from 'path'
import { createApi, addResourcefulRoutes, createQueueConsumer, addRoute } from '../core/_infra'

interface FilesProps extends cdk.StackProps {
  eventBusName: string
  domainName: string
  assetsDomainName: string
  zoneName: string
  jwtIssuer: string
  jwtAudience: string
  filesBucketName: string
}

export class FilesStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FilesProps) {
    super(scope, id, props)

    const filesBucket = this.createBucket(props)

    // DyanmoDB table
    const filesTable = new dynamodb.Table(this, 'FilesTable', {
      partitionKey: { name: 'UserId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'Id', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.RETAIN
    })

    // Files API Gateway
    const { api, authorizer } = createApi(this, {
      zoneName: props.zoneName,
      domainName: props.domainName,
      jwtIssuer: props.jwtIssuer,
      jwtAudience: props.jwtAudience
    })

    // Defaults for lambda functions
    const lambdaDefaults: NodejsFunctionProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(100),
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        EVENT_BUS: props.eventBusName,
        FILES_TABLE: filesTable.tableName,
        BUCKET_NAME: filesBucket.bucketName,
        ASSETS_DOMAIN: props.assetsDomainName
      }
    }

    // Create CRUD routes
    const functions = addResourcefulRoutes(this, api, {
      authorizer,
      lambdaDefaults,
      root: 'files',
      entry: join(__dirname, 'api.ts')
    })

    // Give the CRUD functions access to the bucket and table
    functions.forEach((fn) => {
      filesBucket.grantReadWrite(fn)
      filesTable.grantReadWriteData(fn)
    })

    const uploadRequestFunction = addRoute(this, api, {
      authorizer,
      lambdaDefaults,
      path: '/files/upload',
      method: httpapi.HttpMethod.PUT,
      entry: join(__dirname, 'presigned.ts'),
      handler: 'getUploadURL'
    })

    filesBucket.grantReadWrite(uploadRequestFunction)
    filesTable.grantReadWriteData(uploadRequestFunction)

    // Get the shared event bus
    const eventBus = events.EventBus.fromEventBusName(this, 'EventBus', props.eventBusName)

    // Allow lambdas to send events to the event bus
    functions.forEach((fn) => {
      eventBus.grantPutEventsTo(fn)
    })

    // Queue consumer
    const queueConsumerFunction = createQueueConsumer(this, {
      lambdaDefaults,
      entry: join(__dirname, 'consumer.ts'),
      eventBus,
      sources: {
        'services.assistant': ['assistant.file.created', 'assistant.file.error']
      }
    })
    filesTable.grantReadWriteData(queueConsumerFunction)
  }

  private createBucket(props: FilesProps) {
    const filesBucket = new s3.Bucket(this, 'FilesBucket', {
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      bucketName: props.filesBucketName,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
          allowedOrigins: ['*'],
          allowedHeaders: ['*']
        }
      ]
    })
    const hostedZone = route53.HostedZone.fromLookup(this, 'AssetsHostedZone', {
      domainName: props.zoneName
    })
    const assetCertificate = new cm.Certificate(this, 'AssetsCertificate', {
      domainName: props.assetsDomainName,
      validation: cm.CertificateValidation.fromDns(hostedZone)
    })
    const assetDistribution = new cloudfront.Distribution(this, 'AssetsDistribution', {
      defaultBehavior: { origin: new origins.S3Origin(filesBucket) },
      domainNames: [props.assetsDomainName],
      certificate: assetCertificate,
      comment: 'Proxy for Files Bucket'
    })

    const assetsDomainName = new route53.CnameRecord(this, 'AssetsDomainName', {
      zone: hostedZone,
      domainName: assetDistribution.distributionDomainName,
      recordName: props.assetsDomainName.replace(`.${props.zoneName}`, ''),
      ttl: cdk.Duration.minutes(5)
    })
    return filesBucket
  }
}
