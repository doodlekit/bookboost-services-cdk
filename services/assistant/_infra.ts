import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as httpapi from 'aws-cdk-lib/aws-apigatewayv2'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import * as events from 'aws-cdk-lib/aws-events'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as iam from 'aws-cdk-lib/aws-iam'
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations'

import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs'
import { join } from 'path'

import { addRoute, createApi, createQueueConsumer } from '../core/_infra'
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers'

interface AssistantProps extends cdk.StackProps {
  eventBusName: string
  domainName: string
  zoneName: string
  jwtIssuer: string
  jwtAudience: string
}

export class AssistantStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AssistantProps) {
    super(scope, id, props)

    // DyanmoDB table
    const assistantsTable = new dynamodb.Table(this, 'AssistantsTable', {
      partitionKey: { name: 'UserId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'Id', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.RETAIN
    })
    const chatSessionsTable = new dynamodb.Table(this, 'ChatSessionsTable', {
      partitionKey: { name: 'Id', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY
    })
    const locksTable = new dynamodb.Table(this, 'LocksTable', {
      partitionKey: { name: 'Id', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY
    })

    const openaiApiKey = ssm.StringParameter.valueForStringParameter(this, 'Prod.OPENAI_API_KEY')

    // Defaults for lambda functions
    const lambdaDefaults: NodejsFunctionProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(5),
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        EVENT_BUS: props.eventBusName,
        LOCKS_TABLE: locksTable.tableName,
        ASSISTANTS_TABLE: assistantsTable.tableName,
        CHAT_SESSIONS_TABLE: chatSessionsTable.tableName,
        OPENAI_API_KEY: openaiApiKey
      }
    }

    const streamFunction = new NodejsFunction(this, 'StreamFunction', {
      ...lambdaDefaults,
      timeout: cdk.Duration.seconds(120),
      memorySize: 1024,
      entry: join(__dirname, 'chat', 'stream.ts'),
      handler: 'handler'
    })
    const streamFunctionUrl = new lambda.FunctionUrl(this, 'StreamFunctionUrl', {
      function: streamFunction,
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowCredentials: false,
        allowedHeaders: ['*'],
        allowedOrigins: ['*'],
        allowedMethods: [lambda.HttpMethod.POST]
      }
    })
    const streamFunctionPolicy = new lambda.CfnPermission(this, 'StreamFunctionPolicy', {
      action: 'lambda:InvokeFunctionUrl',
      functionName: streamFunction.functionName,
      principal: '*',
      functionUrlAuthType: 'NONE'
    })

    const createChatSessionFunction = new NodejsFunction(this, 'CreateChatSessionFunction', {
      ...lambdaDefaults,
      environment: {
        CHAT_SESSIONS_TABLE: chatSessionsTable.tableName,
        ASSISTANTS_TABLE: assistantsTable.tableName,
        OPENAI_API_KEY: openaiApiKey,
        STREAM_URL: streamFunctionUrl.url
      },
      entry: join(__dirname, 'chat', 'api.ts'),
      handler: 'createSession'
    })

    // Permissions
    assistantsTable.grantReadWriteData(streamFunction)
    chatSessionsTable.grantReadWriteData(streamFunction)

    assistantsTable.grantReadWriteData(createChatSessionFunction)
    chatSessionsTable.grantReadWriteData(createChatSessionFunction)

    const { api, authorizer } = createApi(this, {
      zoneName: props.zoneName,
      domainName: props.domainName,
      jwtIssuer: props.jwtIssuer,
      jwtAudience: props.jwtAudience
    })

    // API Gateway
    api.addRoutes({
      path: '/sessions',
      methods: [httpapi.HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        'CreateChatSessionFunctionIntegration',
        createChatSessionFunction
      ),
      authorizer
    })

    // Content generation
    const { createContentFunction, contentGenerationTable } = setupContentGeneration(
      this,
      props,
      api,
      authorizer
    )
    const { promptsTable } = setupPromptAdmin(this, api, authorizer)
    const { metadataTable } = setupMetadata(this, api, authorizer, assistantsTable)
    setupAutogen(this, api, authorizer, assistantsTable, contentGenerationTable, promptsTable)

    // Get the shared event bus
    const eventBus = events.EventBus.fromEventBusName(this, 'EventBus', props.eventBusName)

    // Queue consumer
    const queueConsumerFunction = createQueueConsumer(this, {
      lambdaDefaults: {
        ...lambdaDefaults,
        timeout: cdk.Duration.seconds(120),
        memorySize: 1024,
        environment: {
          ASSISTANTS_TABLE: assistantsTable.tableName,
          CHAT_SESSIONS_TABLE: chatSessionsTable.tableName,
          LOCKS_TABLE: locksTable.tableName,
          CONTENT_GEN_TABLE: contentGenerationTable.tableName,
          PROMPT_TABLE: promptsTable.tableName,
          USER_METADATA_TABLE: metadataTable.tableName,
          EVENT_BUS: props.eventBusName,
          OPENAI_API_KEY: openaiApiKey
        }
      },
      entry: join(__dirname, 'consumer.ts'),
      eventBus,
      sources: {
        'services.files': ['file.created', 'file.updated', 'file.deleted'],
        'services.assistant': ['content.ready']
      }
    })

    eventBus.grantPutEventsTo(queueConsumerFunction)
    eventBus.grantPutEventsTo(createContentFunction)

    assistantsTable.grantReadWriteData(queueConsumerFunction)
    chatSessionsTable.grantReadWriteData(queueConsumerFunction)
    locksTable.grantReadWriteData(queueConsumerFunction)
    contentGenerationTable.grantReadWriteData(queueConsumerFunction)
    promptsTable.grantReadWriteData(queueConsumerFunction)
    metadataTable.grantReadWriteData(queueConsumerFunction)
  }
}

function setupContentGeneration(
  stack: cdk.Stack,
  props: AssistantProps,
  api: httpapi.HttpApi,
  authorizer: HttpJwtAuthorizer
) {
  const contentGenerationTable = new dynamodb.Table(stack, 'ContentGenerationTable', {
    partitionKey: { name: 'UserId', type: dynamodb.AttributeType.STRING },
    removalPolicy: cdk.RemovalPolicy.DESTROY
  })
  const lambdaDefaults: NodejsFunctionProps = {
    runtime: lambda.Runtime.NODEJS_20_X,
    timeout: cdk.Duration.seconds(5),
    tracing: lambda.Tracing.ACTIVE,
    environment: {
      EVENT_BUS: props.eventBusName,
      CONTENT_GEN_TABLE: contentGenerationTable.tableName
    },
    entry: join(__dirname, 'content', 'api.ts')
  }
  const createContentFunction = addRoute(stack, api, {
    authorizer,
    lambdaDefaults,
    path: '/content',
    method: httpapi.HttpMethod.POST,
    entry: join(__dirname, 'content', 'api.ts'),
    handler: 'create'
  })
  const getContentFunction = addRoute(stack, api, {
    authorizer,
    lambdaDefaults,
    path: '/content',
    method: httpapi.HttpMethod.GET,
    entry: join(__dirname, 'content', 'api.ts'),
    handler: 'get'
  })
  contentGenerationTable.grantReadWriteData(createContentFunction)
  contentGenerationTable.grantReadData(getContentFunction)
  return { contentGenerationTable, createContentFunction, getContentFunction }
}

function setupPromptAdmin(stack: cdk.Stack, api: httpapi.HttpApi, authorizer: HttpJwtAuthorizer) {
  const promptsTable = new dynamodb.Table(stack, 'PromptsTable', {
    partitionKey: { name: 'ContentType', type: dynamodb.AttributeType.STRING },
    removalPolicy: cdk.RemovalPolicy.RETAIN,
    importSource: {
      bucket: s3.Bucket.fromBucketName(stack, 'PromptsBucket', 'bookboost-metadata'),
      keyPrefix: 'BookBoost-Prompts-v1.csv',
      inputFormat: dynamodb.InputFormat.csv(),
      compressionType: dynamodb.InputCompressionType.NONE
    }
  })
  const lambdaDefaults: NodejsFunctionProps = {
    runtime: lambda.Runtime.NODEJS_20_X,
    timeout: cdk.Duration.seconds(5),
    tracing: lambda.Tracing.ACTIVE,
    environment: {
      PROMPT_TABLE: promptsTable.tableName
    }
  }
  const updatePromptFunction = addRoute(stack, api, {
    authorizer,
    authorizationScopes: ['manage:prompts'],
    lambdaDefaults,
    path: '/admin/prompts',
    method: httpapi.HttpMethod.PUT,
    entry: join(__dirname, 'prompts', 'admin.ts'),
    handler: 'update'
  })
  const listPromptsFunction = addRoute(stack, api, {
    authorizer,
    authorizationScopes: ['manage:prompts'],
    lambdaDefaults,
    path: '/admin/prompts',
    method: httpapi.HttpMethod.GET,
    entry: join(__dirname, 'prompts', 'admin.ts'),
    handler: 'list'
  })

  promptsTable.grantReadWriteData(updatePromptFunction)
  promptsTable.grantReadData(listPromptsFunction)
  return { promptsTable, updatePromptFunction, listPromptsFunction }
}

function setupAutogen(
  stack: cdk.Stack,
  api: httpapi.HttpApi,
  authorizer: HttpJwtAuthorizer,
  assistantsTable: dynamodb.Table,
  contentGenerationTable: dynamodb.Table,
  promptsTable: dynamodb.Table
) {
  const autogenTable = new dynamodb.Table(stack, 'AutogenTable', {
    partitionKey: { name: 'UserId', type: dynamodb.AttributeType.STRING },
    sortKey: { name: 'Id', type: dynamodb.AttributeType.STRING },
    removalPolicy: cdk.RemovalPolicy.RETAIN
  })

  const lambdaDefaults: NodejsFunctionProps = {
    runtime: lambda.Runtime.NODEJS_20_X,
    tracing: lambda.Tracing.ACTIVE,
    timeout: cdk.Duration.seconds(5),
    environment: {
      AUTOGEN_TABLE: autogenTable.tableName
    },
    entry: join(__dirname, 'autogen', 'api.ts')
  }

  const openaiApiKey = ssm.StringParameter.valueForStringParameter(stack, 'Prod.OPENAI_API_KEY')

  const autogenMailerFunction = new NodejsFunction(stack, 'AutogenMailerFunction', {
    ...lambdaDefaults,
    timeout: cdk.Duration.seconds(120),
    memorySize: 1024,
    entry: join(__dirname, 'autogen', 'mailer.ts'),
    handler: 'handler',
    environment: {
      OPENAI_API_KEY: openaiApiKey,
      AUTOGEN_TABLE: autogenTable.tableName,
      ASSISTANTS_TABLE: assistantsTable.tableName,
      CONTENT_GEN_TABLE: contentGenerationTable.tableName,
      PROMPT_TABLE: promptsTable.tableName
    }
  })

  // Allow the scheduler to invoke the mailer lambda function
  const schedulerRole = new iam.Role(stack, 'schedulerRole', {
    assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com')
  })
  const invokeLambdaPolicy = new iam.Policy(stack, 'invokeLambdaPolicy', {
    document: new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          actions: ['lambda:InvokeFunction'],
          resources: [autogenMailerFunction.functionArn],
          effect: iam.Effect.ALLOW
        })
      ]
    })
  })

  schedulerRole.attachInlinePolicy(invokeLambdaPolicy)

  autogenMailerFunction.addToRolePolicy(
    new iam.PolicyStatement({
      actions: ['ses:SendEmail', 'SES:SendRawEmail'],
      resources: ['*'],
      effect: iam.Effect.ALLOW
    })
  )

  const createAutogenFunction = addRoute(stack, api, {
    authorizer,
    lambdaDefaults: {
      ...lambdaDefaults,
      environment: {
        AUTOGEN_TABLE: autogenTable.tableName,
        SCHEDULE_ROLE_ARN: schedulerRole.roleArn,
        SCHEDULE_FUNCTION_ARN: autogenMailerFunction.functionArn,
        ROLE_STRING: `arn:aws:iam::${stack.account}:role/*`
      }
    },
    path: '/autogen',
    method: httpapi.HttpMethod.POST,
    entry: join(__dirname, 'autogen', 'api.ts'),
    handler: 'create'
  })
  const listAutogenFunction = addRoute(stack, api, {
    authorizer,
    lambdaDefaults,
    path: '/autogen',
    method: httpapi.HttpMethod.GET,
    entry: join(__dirname, 'autogen', 'api.ts'),
    handler: 'list'
  })
  const deleteAutogenFunction = addRoute(stack, api, {
    authorizer,
    lambdaDefaults,
    path: '/autogen/{id}',
    method: httpapi.HttpMethod.DELETE,
    entry: join(__dirname, 'autogen', 'api.ts'),
    handler: 'destroy'
  })
  // Allow the lambda function to create schedules
  createAutogenFunction.addToRolePolicy(
    new iam.PolicyStatement({
      actions: ['scheduler:CreateSchedule'],
      resources: ['*'],
      effect: iam.Effect.ALLOW
    })
  )
  createAutogenFunction.addToRolePolicy(
    new iam.PolicyStatement({
      actions: ['iam:PassRole'],
      effect: iam.Effect.ALLOW,
      resources: [`arn:aws:iam::${stack.account}:role/*`],
      conditions: {
        StringEquals: {
          'iam:PassedToService': 'scheduler.amazonaws.com'
        }
      }
    })
  )
  deleteAutogenFunction.addToRolePolicy(
    new iam.PolicyStatement({
      actions: ['scheduler:DeleteSchedule'],
      resources: ['*'],
      effect: iam.Effect.ALLOW
    })
  )

  autogenTable.grantReadWriteData(createAutogenFunction)
  autogenTable.grantReadData(listAutogenFunction)
  autogenTable.grantReadWriteData(deleteAutogenFunction)

  autogenTable.grantReadWriteData(autogenMailerFunction)
  assistantsTable.grantReadData(autogenMailerFunction)
  contentGenerationTable.grantReadWriteData(autogenMailerFunction)
  promptsTable.grantReadData(autogenMailerFunction)

  return { autogenTable }
}

function setupMetadata(
  stack: cdk.Stack,
  api: httpapi.HttpApi,
  authorizer: HttpJwtAuthorizer,
  assistantsTable: dynamodb.Table
) {
  const metadataTable = new dynamodb.Table(stack, 'UserMetadataTable', {
    partitionKey: { name: 'UserId', type: dynamodb.AttributeType.STRING },
    removalPolicy: cdk.RemovalPolicy.RETAIN
  })
  const openaiApiKey = ssm.StringParameter.valueForStringParameter(stack, 'Prod.OPENAI_API_KEY')
  const lambdaDefaults: NodejsFunctionProps = {
    runtime: lambda.Runtime.NODEJS_20_X,
    timeout: cdk.Duration.seconds(5),
    tracing: lambda.Tracing.ACTIVE,
    environment: {
      OPENAI_API_KEY: openaiApiKey,
      USER_METADATA_TABLE: metadataTable.tableName,
      ASSISTANTS_TABLE: assistantsTable.tableName
    },
    entry: join(__dirname, 'metadata', 'api.ts')
  }
  const updateMetadataFunction = addRoute(stack, api, {
    authorizer,
    lambdaDefaults,
    path: '/metadata',
    method: httpapi.HttpMethod.PUT,
    entry: join(__dirname, 'metadata', 'api.ts'),
    handler: 'update'
  })
  const getMetadataFunction = addRoute(stack, api, {
    authorizer,
    lambdaDefaults,
    path: '/metadata',
    method: httpapi.HttpMethod.GET,
    entry: join(__dirname, 'metadata', 'api.ts'),
    handler: 'get'
  })
  metadataTable.grantReadWriteData(updateMetadataFunction)
  metadataTable.grantReadData(getMetadataFunction)
  assistantsTable.grantReadData(updateMetadataFunction)

  return { metadataTable }
}
