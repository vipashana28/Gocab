import GoogleProvider from 'next-auth/providers/google'
import type { NextAuthOptions } from 'next-auth'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: '/',
    signOut: '/',
    error: '/',
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        // Add the Google user ID to the session
        (session.user as { id?: string; googleId?: string }).id = token.sub as string;
        (session.user as { id?: string; googleId?: string }).googleId = token.sub as string;
      }
      return session;
    },
    async jwt({ token, user, account }) {
      if (user && account) {
        // Store the Google user ID from the OAuth provider
        token.sub = account.providerAccountId || user.id;
      }
      return token;
    },
    async redirect({ url, baseUrl }) {
      // Handle redirect after sign in
      console.log('NextAuth redirect callback:', { url, baseUrl })
      
      // If the URL contains a callbackUrl, use it
      if (url.includes('callbackUrl=')) {
        const urlParams = new URLSearchParams(url.split('?')[1])
        const callbackUrl = urlParams.get('callbackUrl')
        if (callbackUrl) {
          // Ensure it's a relative URL for security
          if (callbackUrl.startsWith('/')) {
            console.log('Using callbackUrl:', callbackUrl)
            return `${baseUrl}${callbackUrl}`
          }
        }
      }
      
      // Check if this is a driver sign-in by looking at the URL
      if (url.includes('/driver') || url.includes('callbackUrl=%2Fdriver')) {
        console.log('Driver sign-in detected, redirecting to /driver')
        return `${baseUrl}/driver`
      }
      
      // Default redirect to dashboard for regular users
      if (url === baseUrl || url.startsWith(baseUrl)) {
        console.log('Default redirect to /dashboard')
        return `${baseUrl}/dashboard`
      }
      
      // For external URLs, redirect to dashboard for security
      console.log('External URL detected, redirecting to /dashboard for security')
      return `${baseUrl}/dashboard`
    },
  },
}
