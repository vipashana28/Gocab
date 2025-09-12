'use client'

import { useState, useEffect } from 'react'
import { useSession, signIn as nextAuthSignIn, signOut as nextAuthSignOut } from 'next-auth/react'

export interface GoCabUser {
  id: string
  googleId: string
  email: string
  firstName: string
  lastName: string
  phone?: string
  profilePicture?: string
  isSponsored: boolean
  totalRides: number
  totalCarbonSaved: number
  memberSince: Date
  isVerified: boolean
}

export function useGoCabAuth() {
  const { data: session, status } = useSession()
  
  const [user, setUser] = useState<GoCabUser | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check authentication: Google OAuth only
  const isAuthenticated = status === 'authenticated' && !!user

  // Sync user data when Google auth state changes
  useEffect(() => {
    const syncUserData = async () => {
      if (status === 'authenticated' && session?.user && !user) {
        setIsLoading(true)
        setError(null)
        
        try {
          const response = await fetch('/api/auth/sync-user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              // Use the proper Google user ID from the session
              googleId: (session.user as any).googleId || (session.user as any).id || session.user.email,
              email: session.user.email || '',
              firstName: session.user.name?.split(' ')[0] || 'User',
              lastName: session.user.name?.split(' ').slice(1).join(' ') || '',
              profilePicture: session.user.image,
            }),
          })

          if (response.ok) {
            const userData = await response.json()
            setUser(userData.data)
            if (process.env.NODE_ENV === 'development') {
              console.log('User synced with GoCab database:', userData.data)
            }
          } else {
            const errorData = await response.json()
            setError(errorData.error?.message || 'Failed to sync user data')
          }
        } catch (err) {
          console.error('Error syncing user data:', err)
          setError('Failed to connect to GoCab services')
        } finally {
          setIsLoading(false)
        }
      } else if (status === 'unauthenticated' && user) {
        // Clear user data when signed out
        setUser(null)
        setError(null)
      }
    }

    syncUserData()
  }, [status, session]) // Remove user from dependencies to prevent loops

  const handleSignIn = async (redirectTo: string = '/dashboard') => {
    setError(null)
    try {
      console.log('🚀 Starting Google Auth sign in...', { redirectTo })
      await nextAuthSignIn('google', { callbackUrl: redirectTo })
    } catch (err) {
      console.error('Sign in error:', err)
      setError('Failed to sign in with Google')
    }
  }

  const handleSignOut = async () => {
    setError(null)
    try {
      console.log('👋 Signing out...')
      await nextAuthSignOut({ callbackUrl: '/' })
      setUser(null)
    } catch (err) {
      console.error('Sign out error:', err)
      setError('Failed to sign out')
    }
  }



  const updateLastActive = async () => {
    if (user) {
      try {
        await fetch('/api/auth/update-activity', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: user.id }),
        })
      } catch (err) {
        console.error('Failed to update activity:', err)
      }
    }
  }

  return {
    // Auth state
    isAuthenticated,
    user,
    isLoading: status === 'loading' || isLoading,
    error,
    
    // Auth actions
    signIn: handleSignIn,
    signOut: handleSignOut,
    updateLastActive,
    
    // Utilities
    clearError: () => setError(null),
  }
}
