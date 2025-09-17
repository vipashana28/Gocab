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
      console.log('NextAuth redirect callback:', { url, baseUrl })
      
      // Allow same origin URLs
      if (url.startsWith(baseUrl)) {
        console.log('Same origin URL, allowing:', url)
        return url
      }
      
      // For relative URLs, prepend baseUrl
      if (url.startsWith('/')) {
        console.log('Relative URL, prepending baseUrl:', `${baseUrl}${url}`)
        return `${baseUrl}${url}`
      }
      
      // Default fallback to dashboard
      console.log('Fallback to dashboard')
      return `${baseUrl}/dashboard`
    },
  },
}
