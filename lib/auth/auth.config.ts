import GoogleProvider from 'next-auth/providers/google'
import type { NextAuthOptions } from 'next-auth'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  // Essential for Vercel/edge deployment
  ...(process.env.NODE_ENV === 'production' && { trustHost: true }),
  pages: {
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
      console.log('NextAuth redirect callback:', { url, baseUrl })
      
      // Parse the destination URL
      const destination = url.startsWith(baseUrl) ? url : (url.startsWith('/') ? `${baseUrl}${url}` : baseUrl)
      const path = new URL(destination).pathname
      
      // Never redirect back to sign-in page or root on success
      if (path.startsWith('/api/auth/signin') || path === '/') {
        console.log('Preventing loop - redirecting to dashboard instead')
        return `${baseUrl}/dashboard`
      }
      
      console.log('Final redirect destination:', destination)
      return destination
    },
  },
}
