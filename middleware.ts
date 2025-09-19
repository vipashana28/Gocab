import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow NextAuth routes and auth-related APIs
  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next()
  }

  // For all other API routes, require authentication
  if (pathname.startsWith('/api/')) {
    try {
      const token = await getToken({ 
        req: request, 
        secret: process.env.NEXTAUTH_SECRET 
      })

      if (!token) {
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
    } catch (error) {
      console.error('Middleware auth error:', error)
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'AUTH_ERROR',
            message: 'Authentication verification failed.'
          }
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
    }
  }

  // Protected page routes
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/driver') || pathname.startsWith('/events')) {
    try {
      const token = await getToken({ 
        req: request, 
        secret: process.env.NEXTAUTH_SECRET 
      })

      console.log('Middleware checking protected route:', pathname, 'Token exists:', !!token)

      if (!token) {
        // Don't redirect if this is already a callback from OAuth
        const isOAuthCallback = request.nextUrl.searchParams.has('code') || 
                               request.nextUrl.searchParams.has('state') ||
                               request.nextUrl.searchParams.has('error')
        
        if (isOAuthCallback) {
          console.log('OAuth callback detected, allowing through middleware')
          return NextResponse.next()
        }

        console.log('No token found, redirecting to home page')
        const url = request.nextUrl.clone()
        url.pathname = '/'
        url.searchParams.set('error', 'unauthorized')
        return NextResponse.redirect(url)
      }
    } catch (error) {
      console.error('Page auth error:', error)
      const url = request.nextUrl.clone()
      url.pathname = '/'
      url.searchParams.set('error', 'auth_error')
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  // Protect all API routes except NextAuth and all protected pages
  matcher: [
    '/api/((?!auth).*)',  // All API routes except /api/auth/*
    '/dashboard/:path*',
    '/driver/:path*', 
    '/events/:path*'
  ]
}