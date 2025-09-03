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
    demoSignIn,
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
      router.push('/dashboard')
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
    <div className="min-h-screen bg-gray-900 flex items-center justify-center relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-900/20 to-green-900/20"></div>
        <div className="absolute top-1/4 -left-32 w-64 h-64 bg-blue-500 rounded-full opacity-5 animate-pulse"></div>
        <div className="absolute top-3/4 -right-32 w-96 h-96 bg-green-500 rounded-full opacity-5 animate-pulse" style={{animationDelay: '2s'}}></div>
        <div className="absolute bottom-0 left-1/2 w-80 h-80 bg-blue-600 rounded-full opacity-5 animate-pulse" style={{animationDelay: '4s'}}></div>
      </div>

      <div className="text-center max-w-md mx-auto p-8 relative z-10">
        {/* Logo and Title */}
        <div className="mb-8">
          <h1 className="text-6xl font-bold text-white mb-4">
            Go<span className="text-blue-400">Cab</span>
          </h1>
          <p className="text-xl text-gray-300 leading-relaxed">
            Your <span className="text-blue-400 font-semibold">eco-friendly</span> ride is just a tap away.
          </p>
          <p className="text-gray-400 mt-2">
            Track your <span className="text-green-400 font-semibold">carbon savings</span> while cruising through the city.
          </p>
        </div>
        
        {/* Error Display */}
        {error && (
          <div className="mb-6 bg-red-900/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg animate-shake">
            <div className="flex items-center space-x-2">
              <span className="text-xl">⚠️</span>
              <span className="font-medium">{error}</span>
            </div>
            <button 
              onClick={clearError}
              className="text-red-200 underline text-sm mt-1 hover:text-red-100"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Authentication Buttons */}
        <div className="space-y-4 mb-8">
          <button 
            className="w-full bg-white text-gray-900 font-medium py-4 px-6 rounded-xl transition-all duration-300 hover:bg-gray-100 hover:shadow-xl flex items-center justify-center space-x-3 transform hover:scale-105"
            disabled={isLoading}
            onClick={signIn}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>{isLoading ? 'Connecting...' : 'Continue with Google'}</span>
          </button>
          
          <button 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-4 px-6 rounded-xl transition-all duration-300 hover:shadow-xl transform hover:scale-105"
            disabled={isLoading}
            onClick={demoSignIn}
          >
            <div className="flex items-center justify-center space-x-3">
              <span className="text-xl">🚀</span>
              <span>{isLoading ? 'Loading...' : 'Try Demo'}</span>
              <span className="text-xl">✨</span>
            </div>
          </button>
        </div>

        {/* Features Preview */}
        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            { emoji: '🚗', title: 'Instant', subtitle: 'Booking' },
            { emoji: '🌱', title: 'Carbon', subtitle: 'Tracking' },
            { emoji: '📱', title: 'Live', subtitle: 'Updates' }
          ].map((feature, index) => (
            <div key={index} className="group">
              <div className="w-12 h-12 bg-white/10 rounded-xl mx-auto mb-2 flex items-center justify-center group-hover:bg-white/20 transition-colors duration-300">
                <span className="text-2xl">{feature.emoji}</span>
              </div>
              <p className="text-white font-semibold text-sm">{feature.title}</p>
              <p className="text-gray-400 text-xs">{feature.subtitle}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-gray-500 text-sm">
            Ready to start your eco-friendly journey? 🌍
          </p>
        </div>
      </div>
    </div>
  )
}