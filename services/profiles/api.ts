import { ManagementClient } from 'auth0'
import { publish } from '../core/messages'

const auth0Domain = process.env.AUTH0_DOMAIN
const clientId = process.env.AUTH0_CLIENT_ID
const clientSecret = process.env.AUTH0_CLIENT_SECRET

export async function update(event: any) {
  const userId = event.requestContext.authorizer.jwt.claims.sub
  const requestBody = JSON.parse(event.body)
  const { userMetadata } = requestBody
  if (!auth0Domain || !clientId || !clientSecret) {
    throw new Error('Auth0 environment variables not set')
  }
  const management = new ManagementClient({
    domain: auth0Domain,
    clientId: clientId,
    clientSecret: clientSecret
  })

  const params = { id: userId }
  const data = await transform(userId, userMetadata)
  const response = await management.users.update(params, data)
  const user = response.data
  await publish('services.profiles', 'profile.updated', {
    user
  })
  return {
    statusCode: 200,
    body: 'User metadata updated successfully'
  }
}

async function transform(userId: string, metadata: any) {
  const data: any = {}
  if (metadata.user_metadata && Object.keys(metadata.user_metadata).length > 0) {
    data.user_metadata = metadata.user_metadata
  }
  if (userId.includes('auth0')) {
    if (metadata.name) {
      data.name = metadata.name
    }
    if (metadata.picture) {
      data.picture = metadata.picture
    }
    if (metadata.email) {
      data.email = metadata.email
    }
    if (metadata.password) {
      data.password = metadata.password
    }
  } else {
    if (metadata.picture !== undefined) {
      data.user_metadata = data.user_metadata || {}
      data.user_metadata.picture = metadata.picture
    }
  }
  return data
}

export async function get(event: any) {
  if (!auth0Domain || !clientId || !clientSecret) {
    throw new Error('Auth0 environment variables not set')
  }
  const userId = event.requestContext.authorizer.jwt.claims.sub
  const management = new ManagementClient({
    domain: auth0Domain,
    clientId: clientId,
    clientSecret: clientSecret
  })

  const user = await management.users.get({ id: userId })
  if (!user) {
    return {
      statusCode: 404,
      body: 'User not found'
    }
  }
  console.log('User:', user)
  return {
    statusCode: 200,
    body: JSON.stringify(user.data)
  }
}

export async function sendVerificationEmail(event: any) {
  if (!auth0Domain || !clientId || !clientSecret) {
    throw new Error('Auth0 environment variables not set')
  }

  const userId = event.requestContext.authorizer.jwt.claims.sub

  const management = new ManagementClient({
    domain: auth0Domain,
    clientId: clientId,
    clientSecret: clientSecret
  })

  const response = await management.jobs.verifyEmail({ user_id: userId })
  console.log('Verification email sent:', response)
  return {
    statusCode: 200,
    body: 'Verification email sent'
  }
}
