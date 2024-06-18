import * as cdk from 'aws-cdk-lib'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import { NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs'

export const lambdaParams = (params: NodejsFunctionProps): NodejsFunctionProps => ({
  runtime: lambda.Runtime.NODEJS_20_X,
  timeout: cdk.Duration.seconds(5),
  tracing: lambda.Tracing.ACTIVE,
  bundling: {
    minify: true,
    sourceMap: true
  },
  ...params,
  environment: {
    NODE_OPTIONS: '--enable-source-maps',
    ...params.environment
  }
})
