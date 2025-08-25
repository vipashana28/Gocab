'use client'

import { useState, useEffect } from 'react'
import { useSession, signIn as nextAuthSignIn, signOut as nextAuthSignOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'

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
  const router = useRouter()
  
  const [user, setUser] = useState<GoCabUser | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check authentication: either Google OAuth or demo user
  const isAuthenticated = (status === 'authenticated' && !!user) || (!!user && user.id.startsWith('demo-'))

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
            console.log('User synced with GoCab database:', userData.data)
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
  }, [status, session, user])

  const handleSignIn = async () => {
    setError(null)
    try {
      console.log('🚀 Starting Google Auth sign in...')
      await nextAuthSignIn('google', { callbackUrl: '/dashboard' })
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

  const demoSignIn = () => {
    console.log('🚀 Performing demo sign in...')
    setIsLoading(true)
    
    const demoUser: GoCabUser = {
      id: 'demo-user-123',
      googleId: 'google-demo-id-123',
      email: 'demo.user@gocab.app',
      firstName: 'Demo',
      lastName: 'User',
      phone: '555-123-4567',
      profilePicture: `https://i.pravatar.cc/150?u=demo-user-123`,
      isSponsored: true,
      totalRides: 42,
      totalCarbonSaved: 15.7,
      memberSince: new Date('2023-01-15T10:00:00Z'),
      isVerified: true,
    }

    setUser(demoUser)
    console.log('✅ Demo user created:', demoUser)
    
    setTimeout(() => {
      setIsLoading(false)
      console.log('🎯 Redirecting to dashboard...')
      router.push('/dashboard')
    }, 200)
  }

  const updateLastActive = async () => {
    if (user && !user.id.startsWith('demo-')) {
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
    demoSignIn,
    updateLastActive,
    
    // Utilities
    clearError: () => setError(null),
  }
}
