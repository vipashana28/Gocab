import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

const PUBLIC_FILE = /\.(.*)$/

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  // 1) Always allow auth endpoints, Next.js internals, static files, and OPTIONS
  if (
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/icons/') ||
    PUBLIC_FILE.test(pathname) ||
    request.method === 'OPTIONS'
  ) {
    return NextResponse.next()
  }

  // 2) Protect API routes (except /api/auth/* handled above)
  if (pathname.startsWith('/api/')) {
    try {
      const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
        secureCookie: process.env.NODE_ENV === 'production',
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
      console.error('Middleware API auth error:', error)
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
    return NextResponse.next()
  }

  // 3) Protect app pages
  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/driver') ||
    pathname.startsWith('/events')

  if (!isProtected) return NextResponse.next()

  // Special: if we just came from the OAuth callback, allow one pass to avoid race condition
  const referer = request.headers.get('referer') || ''
  const cameFromAuthCallback = referer.includes('/api/auth/callback')

  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
      secureCookie: process.env.NODE_ENV === 'production',
    })

    console.log('Middleware checking protected route:', pathname, 'Token exists:', !!token, 'Referer:', referer)

    if (token || cameFromAuthCallback) {
      // Let the page render; the session will be available on the next request if it's a race
      return NextResponse.next()
    }

    // Don't redirect back to home to avoid loops - use error parameter instead
    console.log('No token found, redirecting to home page')
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.searchParams.set('from', pathname)
    url.searchParams.set('error', 'unauthorized')
    return NextResponse.redirect(url)
  } catch (error) {
    console.error('Page auth error:', error)
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.searchParams.set('error', 'auth_error')
    return NextResponse.redirect(url)
  }
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