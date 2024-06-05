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

interface NotificationsProps extends cdk.StackProps {
  eventBusName: string
  domainName: string
  zoneName: string
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

    // Defaults for lambda functions
    const lambdaDefaults: NodejsFunctionProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(5),
      tracing: lambda.Tracing.ACTIVE,
      entry: join(__dirname, 'api.ts'),
      environment: {
        CONNECTIONS_TABLE: connectionsTable.tableName,
        SOCKET_URL: `https://${props.domainName}`
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
    const queueConsumerFunction = createQueueConsumer(
      this,
      lambdaDefaults,
      join(__dirname, 'consumer.ts'),
      eventBus,
      {
        'services.assistant': ['content.generated']
      }
    )
    queueConsumerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['execute-api:ManageConnections'],
        resources: ['*']
      })
    )

    eventBus.grantPutEventsTo(queueConsumerFunction)
    connectionsTable.grantReadWriteData(queueConsumerFunction)
  }
}
