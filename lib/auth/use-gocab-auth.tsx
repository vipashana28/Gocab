'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@civic/auth/react'
import { useRouter } from 'next/navigation'

// Civic Auth user interface matches BaseUser from @civic/auth
interface CivicUser {
  id: string
  email?: string
  username?: string
  name?: string
  given_name?: string
  family_name?: string
  picture?: string
  updated_at?: Date
}

export interface GoCabUser {
  id: string
  civicId: string
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
  const router = useRouter()
  
  // Use REAL Civic Auth hooks from the SDK
  const { 
    user: civicUser, 
    isLoading: authLoading, 
    authStatus,
    error: civicError,
    signIn: civicSignIn, 
    signOut: civicSignOut
  } = useUser()
  
  // Determine if authenticated based on authStatus
  const isAuthenticated = authStatus === 'authenticated'
  
  const [user, setUser] = useState<GoCabUser | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync user data when Civic auth state changes
  useEffect(() => {
    const syncUserData = async () => {
      if (isAuthenticated && civicUser && !user) {
        setIsLoading(true)
        setError(null)
        
        try {
          // Try to get existing user from our database
          const response = await fetch('/api/auth/sync-user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              civicId: civicUser.id,
              email: civicUser.email || `user_${civicUser.id}@gocab.app`,
              walletAddress: null, // No wallet address in base Civic Auth
              // Extract additional fields if available from Civic user
              firstName: civicUser.given_name || civicUser.name?.split(' ')[0] || 'User',
              lastName: civicUser.family_name || civicUser.name?.split(' ').slice(1).join(' ') || '',
              profilePicture: civicUser.picture,
            }),
          })

          if (response.ok) {
            const userData = await response.json()
            setUser(userData.data)
            console.log('User synced with GoCab database:', userData.data)
            
            // ✅ REDIRECT TO DASHBOARD AFTER SUCCESSFUL AUTH
            console.log('🎯 Redirecting to dashboard...')
            router.push('/dashboard')
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
      } else if (!isAuthenticated && user) {
        // Clear user data when signed out
        setUser(null)
        setError(null)
      }
    }

    syncUserData()
  }, [isAuthenticated, civicUser, user, router])

  const handleSignIn = async () => {
    setError(null)
    try {
      console.log('🚀 Starting Civic Auth sign in...')
      // Use the proper Civic Auth signIn function
      await civicSignIn()
    } catch (err) {
      console.error('Sign in error:', err)
      setError('Failed to sign in with Civic')
    }
  }

  const handleSignOut = async () => {
    setError(null)
    try {
      console.log('👋 Signing out of Civic Auth...')
      await civicSignOut()
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
    isAuthenticated: isAuthenticated && !!user,
    user,
    civicUser,
    isLoading: authLoading || isLoading,
    error: error || (civicError?.message ?? null),
    
    // Auth actions
    signIn: handleSignIn,
    signOut: handleSignOut,
    updateLastActive,
    
    // Utilities
    clearError: () => setError(null),
  }
}
