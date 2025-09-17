import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/auth.config'

export interface AuthenticatedUser {
  id: string
  googleId: string
  email: string
  name?: string
  image?: string
}

export async function getAuthenticatedUser(request: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return null
    }

    return {
      id: (session.user as any).id || (session.user as any).googleId || session.user.email,
      googleId: (session.user as any).googleId || (session.user as any).id,
      email: session.user.email || '',
      name: session.user.name || undefined,
      image: session.user.image || undefined
    }
  } catch (error) {
    console.error('Error getting authenticated user:', error)
    return null
  }
}

export function createUnauthorizedResponse() {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Please sign in to access this resource.'
      }
    }),
    {
      status: 401,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  )
}

export function createForbiddenResponse() {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Insufficient permissions to access this resource.'
      }
    }),
    {
      status: 403,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  )
}
