import { createCivicAuthPlugin } from "@civic/auth/nextjs"

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  env: {
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    MONGODB_URI: process.env.MONGODB_URI,
    JWT_SECRET: process.env.JWT_SECRET,
  },
}

// Create Civic Auth plugin with client ID
const withCivicAuth = createCivicAuthPlugin({
  clientId: process.env.NEXT_PUBLIC_CIVIC_AUTH_CLIENT_ID || "demo-client-id"
})

export default withCivicAuth(nextConfig)
