import * as cdk from 'aws-cdk-lib'
import * as cm from 'aws-cdk-lib/aws-certificatemanager'
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as httpapi from 'aws-cdk-lib/aws-apigatewayv2'
import * as apigw from 'aws-cdk-lib/aws-apigateway'
import * as events from 'aws-cdk-lib/aws-events'
import * as targets from 'aws-cdk-lib/aws-events-targets'
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers'
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import { Tracing } from 'aws-cdk-lib/aws-lambda'

/**
 * Create an HTTP API Gateway with a custom domain and JWT authorizer
 * @param stack Stack to add resources to
 * @param zoneName Route53 hosted zone name
 * @param domainName Custom domain name
 * @param jwtIssuer JWT issuer
 * @param jwtAudience JWT audience
 * @returns API Gateway and Authorizer
 */
export function createApi(
  stack: cdk.Stack,
  zoneName: string,
  domainName: string,
  jwtIssuer: string,
  jwtAudience: string
) {
  const hostedZone = route53.HostedZone.fromLookup(stack, 'HostedZone', {
    domainName: zoneName
  })
  const certificate = new cm.Certificate(stack, 'RestApiCertificate', {
    domainName: domainName,
    validation: cm.CertificateValidation.fromDns(hostedZone)
  })
  const domain = new httpapi.DomainName(stack, 'RestApiDomain', {
    domainName: domainName,
    certificate
  })
  const api = new apigw.RestApi(stack, `${stack.stackName}-RestApiGateway`, {
    endpointTypes: [apigw.EndpointType.REGIONAL],
    deploy: true,
    deployOptions: {
      stageName: 'prod',
      tracingEnabled: true
    },
    defaultCorsPreflightOptions: {
      allowOrigins: apigw.Cors.ALL_ORIGINS,
      allowMethods: apigw.Cors.ALL_METHODS
    },
    domainName: {
      domainName: domain.name,
      certificate: certificate
    }
  })
  const record = new route53.ARecord(stack, 'RestApiRecord', {
    zone: hostedZone,
    target: route53.RecordTarget.fromAlias({
      bind: () => ({
        dnsName: domain.regionalDomainName,
        hostedZoneId: domain.regionalHostedZoneId
      })
    }),
    recordName: domainName
  })
  const authorizer = new HttpJwtAuthorizer('ApiAuthorizer', jwtIssuer, {
    jwtAudience: [jwtAudience]
  })
  return { api, authorizer }
}

interface ResourcefulRoutesParams {
  stack: cdk.Stack
  api: apigw.RestApi
  authorizer: any
  lambdaDefaults: NodejsFunctionProps
  root: string
  entry: string
  parent?: apigw.IResource
}

/**
 * Create a set of resourceful routes for a given root path
 * Expects the following lambda functions to be present in the entry file:
 * - list
 * - get
 * - create
 * - update
 * - destroy
 *
 * These will automatically be added to the API Gateway with the following paths:
 * - GET /{root}
 * - GET /{root}/{id}
 * - POST /{root}
 * - PUT /{root}/{id}
 * - DELETE /{root}/{id}
 *
 * @param stack Stack to add resources to
 * @param api HTTP API Gateway
 * @param authorizer Jwt Authorizer
 * @param lambdaDefaults Default properties for lambda functions
 * @param root Root of the resourceful routes, e.g. 'files'
 * @param entry Path to the entry source file for the lambda functions
 * @returns List of lambda functions created
 */
export function addResourcefulRoutes(params: ResourcefulRoutesParams) {
  const resources = params.api.root.resourceForPath('/' + params.root)
  const resource = resources.addResource('{id}')
  const functions = ['List', 'Get', 'Create', 'Update', 'Destroy'].map((action) => {
    const prefix = params.root
      .replace(/\{.*?\}/, '')
      .split('/')
      .map(capitalizeFirstLetter)
      .join('')
    const name = `${prefix}${action}Function`
    const fn = new NodejsFunction(params.stack, name, {
      ...params.lambdaDefaults,
      entry: params.entry,
      handler: action.toLowerCase(),
      tracing: Tracing.PASS_THROUGH
    })
    const integrationParams = {}
    switch (action) {
      case 'List':
        resources.addMethod('GET', new apigw.LambdaIntegration(fn), integrationParams)
        break
      case 'Create':
        resources.addMethod('POST', new apigw.LambdaIntegration(fn), integrationParams)
        break
      case 'Get':
        resource.addMethod('GET', new apigw.LambdaIntegration(fn), integrationParams)
        break
      case 'Update':
        resource.addMethod('PUT', new apigw.LambdaIntegration(fn), integrationParams)
        break
      case 'Destroy':
        resource.addMethod('DELETE', new apigw.LambdaIntegration(fn), integrationParams)
        break
    }
    return fn
  })

  return functions
}

/**
 * Create a queue consumer lambda function that listens for events from other services
 * @param stack Stack to add resources to
 * @param lambdaDefaults Default properties for lambda functions
 * @param entry Entry file for the lambda function
 * @param eventBus Shared event bus
 * @param sources List of sources and detail types to listen for
 * @returns Lambda function
 */
export function createQueueConsumer(
  stack: cdk.Stack,
  lambdaDefaults: NodejsFunctionProps,
  entry: string,
  eventBus: events.IEventBus,
  sources: { [key: string]: string[] }
) {
  // Queue consumer
  const queueConsumerFunction = new NodejsFunction(stack, 'QueueConsumerFunction', {
    ...lambdaDefaults,
    entry,
    handler: 'handler'
  })

  // Setup consumer to accept events from other services
  for (const source of Object.keys(sources)) {
    const prefix = source.split('.').map(capitalizeFirstLetter).join('')
    const detailType = sources[source]
    const busRule = new events.Rule(stack, `${prefix}BusRules`, {
      eventBus: eventBus,
      eventPattern: {
        source: [source],
        detailType
      }
    })
    busRule.addTarget(new targets.LambdaFunction(queueConsumerFunction))
  }

  return queueConsumerFunction
}

function capitalizeFirstLetter(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
