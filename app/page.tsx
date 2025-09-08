'use client'

import { useEffect } from 'react'
import { useGoCabAuth } from '@/lib/auth/use-gocab-auth-google'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const { 
    isAuthenticated, 
    user, 
    isLoading, 
    error,
    signIn,
    clearError 
  } = useGoCabAuth()
  
  const { status } = useSession()
  const router = useRouter()

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (isAuthenticated && user) {
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ User authenticated, redirecting to dashboard')
      }
      // Add small delay to prevent race conditions during component cleanup
      const timeoutId = setTimeout(() => {
        router.push('/dashboard')
      }, 100)
      
      return () => clearTimeout(timeoutId)
    }
  }, [isAuthenticated, user, router])

  // Show loading if still checking auth
  if (isLoading || status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Loading GoCab...</p>
        </div>
      </div>
    )
  }

  // Show authentication page for unauthenticated users
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-green-50 flex items-center justify-center relative">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-20 w-32 h-32 bg-green-400 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-40 h-40 bg-green-300 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-60 h-60 bg-green-200 rounded-full blur-3xl"></div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl p-12 max-w-md w-full mx-4 relative z-10 border border-green-100">
        {/* Logo and Title */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 mx-auto mb-6 bg-white rounded-2xl p-3 shadow-lg border border-green-200">
            <img 
              src="/icons/GOLOGO.svg" 
              alt="GoCab Logo" 
              className="w-full h-full"
            />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Welcome to Go<span className="text-green-600">Cab</span>
          </h1>
          <p className="text-gray-600 text-lg">
            Your sustainable ride awaits
          </p>
        </div>
        
        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-red-400 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-red-400 rounded-full"></div>
              </div>
              <span className="font-medium">{error}</span>
            </div>
            <button 
              onClick={clearError}
              className="text-red-600 underline text-sm mt-1 hover:text-red-700"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Authentication Button */}
        <button 
          className="w-full bg-white border-2 border-gray-200 text-gray-700 font-medium py-4 px-6 rounded-2xl transition-all duration-300 hover:border-green-300 hover:shadow-lg flex items-center justify-center space-x-3 group"
          disabled={isLoading}
          onClick={signIn}
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span className="text-lg">
            {isLoading ? 'Connecting...' : 'Continue with Google'}
          </span>
        </button>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-gray-500 text-sm">
            Secure authentication powered by Google
          </p>
        </div>
      </div>
    </div>
  )
}