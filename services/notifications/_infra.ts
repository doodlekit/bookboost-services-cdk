import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as httpapi from 'aws-cdk-lib/aws-apigatewayv2'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as cm from 'aws-cdk-lib/aws-certificatemanager'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as events from 'aws-cdk-lib/aws-events'
import { WebSocketLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations'

import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs'
import { join } from 'path'

import { createQueueConsumer } from '../core/_infra'
import { getSources } from './events/router'

interface NotificationsProps extends cdk.StackProps {
  eventBusName: string
  domainName: string
  zoneName: string
  fromEmail: string
  toEmail: string
  emailDomain: string
}

export class NotificationsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: NotificationsProps) {
    super(scope, id, props)

    const connectionsTable = new dynamodb.Table(this, 'ConnectionsTable', {
      partitionKey: { name: 'UserId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'ConnectionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'TimeToLive'
    })

    const notificationsTable = new dynamodb.Table(this, 'NotificationsTable', {
      partitionKey: { name: 'UserId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'Id', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY
    })

    // Defaults for lambda functions
    const lambdaDefaults: NodejsFunctionProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(5),
      tracing: lambda.Tracing.ACTIVE,
      bundling: {
        minify: false,
        sourceMap: true
      },
      entry: join(__dirname, 'socket', 'api.ts'),
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        CONNECTIONS_TABLE: connectionsTable.tableName,
        NOTIFICATIONS_TABLE: notificationsTable.tableName,
        SOCKET_URL: `https://${props.domainName}`,
        FROM_EMAIL: props.fromEmail,
        TO_EMAIL: props.toEmail,
        BASE_DOMAIN: props.emailDomain
      }
    }

    const connectFunction = new NodejsFunction(this, 'ConnectFunction', {
      ...lambdaDefaults,
      handler: 'connect'
    })

    const disconnectFunction = new NodejsFunction(this, 'DisconnectFunction', {
      ...lambdaDefaults,
      handler: 'disconnect'
    })

    connectionsTable.grantReadWriteData(connectFunction)
    connectionsTable.grantReadWriteData(disconnectFunction)

    // Create domain and certificate
    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: props.zoneName
    })
    const certificate = new cm.Certificate(this, 'WebsocketApiCertificate', {
      domainName: props.domainName,
      validation: cm.CertificateValidation.fromDns(hostedZone)
    })
    const domain = new httpapi.DomainName(this, 'WebsocketApiDomain', {
      domainName: props.domainName,
      certificate
    })

    // Create websocket API
    const websocketApi = new httpapi.WebSocketApi(this, 'WebsocketApi', {
      apiName: `${this.stackName}-WebsocketApi`,
      routeSelectionExpression: '$request.body.action',
      connectRouteOptions: {
        integration: new WebSocketLambdaIntegration('ws-connect-integration', connectFunction)
      },
      disconnectRouteOptions: {
        integration: new WebSocketLambdaIntegration('ws-disconnect-integration', disconnectFunction)
      }
    })
    const websocketApiStage = new httpapi.WebSocketStage(this, 'WebsocketApiStage2', {
      webSocketApi: websocketApi,
      autoDeploy: true,
      stageName: 'default'
    })

    // Map domain to API
    new httpapi.CfnApiMapping(this, 'WebsocketApiMapping', {
      apiId: websocketApi.apiId,
      domainName: domain.name,
      stage: websocketApiStage.stageName
    })

    // Create A record to map domain to API
    const record = new route53.ARecord(this, 'WebsocketApiRecord', {
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias({
        bind: () => ({
          dnsName: domain.regionalDomainName,
          hostedZoneId: domain.regionalHostedZoneId
        })
      }),
      recordName: props.domainName
    })

    // Get the shared event bus
    const eventBus = events.EventBus.fromEventBusName(this, 'EventBus', props.eventBusName)

    // Queue consumer
    const queueConsumerFunction = createQueueConsumer(this, {
      lambdaDefaults,
      entry: join(__dirname, 'consumer.ts'),
      eventBus,
      sources: getSources()
    })
    queueConsumerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['execute-api:ManageConnections'],
        resources: ['*']
      })
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

    eventBus.grantPutEventsTo(queueConsumerFunction)
    connectionsTable.grantReadWriteData(queueConsumerFunction)
    notificationsTable.grantReadWriteData(queueConsumerFunction)
  }
}
