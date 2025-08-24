import { createCivicAuthPlugin } from "@civic/auth/nextjs"

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  env: {
    MONGODB_URI: process.env.MONGODB_URI,
    JWT_SECRET: process.env.JWT_SECRET,
  },
}

// Create Civic Auth plugin with client ID (Web3 version)
const withCivicAuth = createCivicAuthPlugin({
  clientId: process.env.NEXT_PUBLIC_CIVIC_AUTH_CLIENT_ID || "41484703-a85a-430b-b058-093a04d0212e",
  loginSuccessUrl: "/dashboard"  // Redirect to dashboard after successful login
})

export default withCivicAuth(nextConfig)
