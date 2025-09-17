import GoogleProvider from 'next-auth/providers/google'
import type { NextAuthOptions } from 'next-auth'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
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
  },
  pages: {
    signIn: '/',
    signOut: '/',
    error: '/',
  },
}
