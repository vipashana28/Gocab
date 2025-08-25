import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Only protect the dashboard route for demo purposes
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    // For demo mode, we'll just let it pass through
    // In a real app, you'd check for authentication here
    return NextResponse.next()
  }
  
  return NextResponse.next()
}

export const config = {
  // Only protect dashboard routes for now
  matcher: ['/dashboard/:path*']
}