import { authMiddleware } from "@civic/auth/nextjs/middleware"

export default authMiddleware()

export const config = {
  // Only protect routes that require authentication
  matcher: [
    '/dashboard/:path*',
    // Protect API routes except auth endpoints
    '/api/((?!auth|health).*)',
  ],
}
