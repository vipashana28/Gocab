import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Protected routes (can add authentication checks here later)
  if (pathname.startsWith('/dashboard')) {
    // For now, just let dashboard through
    // Later: add authentication checks here
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  // Run middleware on protected routes
  matcher: ['/dashboard/:path*']
}