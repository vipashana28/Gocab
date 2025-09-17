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

  // Redirect authenticated users (only if not already redirecting)
  useEffect(() => {
    if (isAuthenticated && user && status === 'authenticated') {
      // Check if we're not already being redirected by NextAuth
      const hasRedirectParam = window.location.search.includes('callbackUrl') || 
                              window.location.search.includes('error')
      
      if (!hasRedirectParam) {
        const timeoutId = setTimeout(() => {
          // Check if this was a driver sign-in attempt by looking at localStorage or URL params
          const urlParams = new URLSearchParams(window.location.search)
          const isDriverFlow = urlParams.get('driver') === 'true' || 
                              localStorage.getItem('pendingDriverSignIn') === 'true'
          
          if (isDriverFlow) {
            localStorage.removeItem('pendingDriverSignIn') // Clean up
            router.push('/driver')
          } else {
            router.push('/dashboard')
          }
        }, 500) // Slightly longer delay to ensure auth is fully settled
        return () => clearTimeout(timeoutId)
      }
    }
  }, [isAuthenticated, user, router, status])

  if (isLoading || status === 'loading') {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-white border-t-transparent mx-auto mb-4"></div>
          <p>Loading GoCabs…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-neutral-50 overflow-hidden">
      {/* Subtle animated grid background */}
      <svg aria-hidden="true" className="absolute inset-0 w-full h-full opacity-[0.03]">
        <defs>
          <pattern id="gc-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="black" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#gc-grid)" />
      </svg>

      {/* Main card */}
      <main className="relative z-10 flex items-center justify-center min-h-screen px-4">
        <section
          className="
            w-full max-w-md bg-white border border-neutral-200 rounded-3xl shadow-xl
            p-8 md:p-10 animate-cardIn
          "
        >
          {/* Logo + Title */}
          <div className="text-center mb-8">
            <div className="mx-auto mb-6 w-20 h-20 rounded-2xl shadow-md bg-white ring-1 ring-neutral-200 flex items-center justify-center">
              <img
                src="/icons/GOLOGO.svg"
                alt="GoCab Logo"
                className="w-12 h-12"
              />
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-neutral-900">
              Welcome to Go <span className="text-green-600">Cabs</span>
            </h1>
            <p className="mt-2 text-neutral-600">
              Your sustainable ride awaits
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <div className="flex items-center gap-2 text-red-700">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86l-8.48 14.7A2 2 0 003.52 21h16.96a2 2 0 001.71-3.44l-8.48-14.7a2 2 0 00-3.42 0z"/>
                </svg>
                <span className="font-medium">{error}</span>
              </div>
              <button
                onClick={clearError}
                className="mt-1 text-sm underline text-red-700 hover:text-red-800"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Google Auth */}
          <button
            onClick={() => signIn()}
            disabled={isLoading}
            className={`
              group relative w-full overflow-hidden
              rounded-2xl border-2 border-neutral-200 bg-white px-6 py-4
              text-lg font-medium text-neutral-800
              transition-transform active:scale-[.99] focus:outline-none
              hover:border-green-300 hover:shadow-lg
            `}
          >
            <span className="relative z-10 flex items-center justify-center gap-3">
              <svg className="w-6 h-6" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>{isLoading ? 'Connecting…' : 'Continue with Google'}</span>
            </span>
          </button>

          {/* Driver Sign In */}
          <div className="mt-8 text-center">
            <div className="border-t border-neutral-200 pt-6 mb-4">
              <p className="text-neutral-600 text-sm mb-3">Are you a driver?</p>
              <button
                onClick={() => {
                  localStorage.setItem('pendingDriverSignIn', 'true')
                  signIn('/driver')
                }}
                className="inline-flex items-center gap-2 text-green-700 hover:text-green-800 font-medium text-sm underline underline-offset-4 transition-colors"
              >
                {/* Sleek car front icon */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M3 13l2-5h14l2 5v6a2 2 0 01-2 2h-1a2 2 0 01-2-2v-1H8v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-6z" />
                  <circle cx="7.5" cy="16.5" r="1.5" />
                  <circle cx="16.5" cy="16.5" r="1.5" />
                </svg>
                <span>Sign in as Driver</span>
              </button>
            </div>
            <p className="text-neutral-500 text-xs">
              Secure authentication powered by Google
            </p>
          </div>
        </section>
      </main>

      <style jsx>{`
        .animate-cardIn {
          animation: cardIn .5s cubic-bezier(.2,.9,.2,1) both;
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(10px) scale(.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}
