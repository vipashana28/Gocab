'use client'

import { CivicAuthProvider } from "@civic/auth/nextjs"
import { ReactNode } from 'react'

interface CivicProviderProps {
  children: ReactNode
}

export default function CivicProvider({ children }: CivicProviderProps) {
  const clientId = process.env.NEXT_PUBLIC_CIVIC_AUTH_CLIENT_ID

  if (!clientId) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🔑</div>
          <h2 className="text-2xl font-bold text-red-800 mb-4">Civic Auth Setup Required</h2>
          <div className="text-left bg-white p-4 rounded-lg shadow-sm border">
            <p className="text-sm text-gray-700 mb-3">
              <strong>Create .env.local file with:</strong>
            </p>
            <div className="bg-gray-100 p-3 rounded text-xs font-mono">
              NEXT_PUBLIC_CIVIC_AUTH_CLIENT_ID=41484703-a85a-430b-b058-093a04d0212e
            </div>
            <p className="text-sm text-gray-700 mt-3">
              Then restart: <code className="bg-gray-100 px-1">npm run dev</code>
            </p>
          </div>
          <div className="mt-4">
            <p className="text-xs text-gray-500">
              Your Client ID is ready - just needs to be configured!
            </p>
          </div>
        </div>
      </div>
    )
  }

  console.log('✅ Civic Auth configured with Client ID:', clientId)

  return (
    <CivicAuthProvider>
      {children}
    </CivicAuthProvider>
  )
}
