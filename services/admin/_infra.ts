import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as httpapi from 'aws-cdk-lib/aws-apigatewayv2'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations'

import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs'
import { join } from 'path'

import { addRoute, createApi } from '../core/_infra'

interface AdminProps extends cdk.StackProps {
  environment: string
  domainName: string
  zoneName: string
  jwtIssuer: string
  jwtAudience: string
}

export class AdminStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AdminProps) {
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
    const lambdaDefaults: NodejsFunctionProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(5),
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        AUTH0_CLIENT_ID: auth0ClientId,
        AUTH0_CLIENT_SECRET: auth0ClientSecret,
        AUTH0_DOMAIN: auth0Domain
      }
    }

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
      path: '/users',
      method: httpapi.HttpMethod.GET,
      entry: join(__dirname, 'api.ts'),
      handler: 'list',
      authorizationScopes: ['manage:users']
    })

    addRoute(this, api, {
      authorizer,
      lambdaDefaults,
      path: '/users/{id}',
      method: httpapi.HttpMethod.GET,
      entry: join(__dirname, 'api.ts'),
      handler: 'get',
      authorizationScopes: ['manage:users']
    })
  }
}
