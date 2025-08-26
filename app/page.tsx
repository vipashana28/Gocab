'use client'

import { useEffect, useState, useRef } from 'react'
import { useGoCabAuth } from '@/lib/auth/use-gocab-auth-google'
import { useSession } from 'next-auth/react'
import { useSocket } from '@/lib/hooks/use-socket'
import dynamic from 'next/dynamic'

// Dynamic import for map to avoid SSR issues
const MapView = dynamic(() => import('@/components/Map/MapView'), { 
  ssr: false,
  loading: () => <div className="w-full h-full bg-gray-200 animate-pulse flex items-center justify-center">Loading Map...</div>
})

interface ActiveRide {
  id: string
  _id?: string  // MongoDB ObjectId for database rides
  rideId: string
  pickupCode: string
  status: 'requested' | 'matched' | 'driver_en_route' | 'arrived' | 'in_progress' | 'completed' | 'cancelled'
  statusDisplay: string
  pickup: {
    address: string
    coordinates: { latitude: number, longitude: number }
  }
  destination: {
    address: string
    coordinates: { latitude: number, longitude: number }
  }
  driverContact?: {
    name: string
    phone: string
    vehicleInfo: string
    licensePlate: string
    photo?: string
  }
  driverLocation?: {
    coordinates: { latitude: number, longitude: number }
    lastUpdated: Date
  }
  pricing: {
    totalEstimated: number
  }
  carbonFootprint: {
    estimatedSaved: number
  }
  requestedAt: Date
  estimatedArrival?: string
}

export default function HomePage() {
  const { 
    isAuthenticated, 
    user, 
    isLoading, 
    error,
    signIn, 
    signOut, 
    demoSignIn,
    updateLastActive,
    clearError 
  } = useGoCabAuth()
  
  const { status } = useSession()
  
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null)
  const [isBookingRide, setIsBookingRide] = useState(false)
  const [showBookingForm, setShowBookingForm] = useState(false)
  const [pickupAddress, setPickupAddress] = useState('')
  const [destinationAddress, setDestinationAddress] = useState('')
  const [userLocation, setUserLocation] = useState<{ latitude: number, longitude: number } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [pickupSuggestions, setPickupSuggestions] = useState<string[]>([])
  const [destinationSuggestions, setDestinationSuggestions] = useState<string[]>([])
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false)
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false)
  
  // Real-time socket connection
  const {
    isConnected: socketConnected,
    connectionError: socketError,
    joinRide,
    leaveRide,
    onDriverLocationUpdate,
    onDriverArrived,
    onRideStatusUpdate,
    simulateDriverMovement
  } = useSocket()
  
  // Track simulation interval for cleanup
  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Location search functions will be defined later with better mock data

  // Update user activity when page loads
  useEffect(() => {
    if (isAuthenticated && user) {
      updateLastActive()
    }
  }, [isAuthenticated, user, updateLastActive])

  // Clear any errors after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearError()
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [error, clearError])

  // Real-time socket events for active rides
  useEffect(() => {
    if (activeRide && socketConnected) {
      console.log('Setting up real-time tracking for ride:', activeRide.rideId)
      
      // Join the ride room for real-time updates
      joinRide(activeRide.rideId)
      
      // Listen for driver location updates
      const unsubscribeLocationUpdate = onDriverLocationUpdate?.((data) => {
        console.log('Received driver location update:', data)
        
        setActiveRide(prev => {
          if (!prev) return prev
          
          const updatedRide = {
            ...prev,
            driverLocation: {
              coordinates: data.coordinates,
              lastUpdated: new Date()
            },
            estimatedArrival: data.estimatedArrival || prev.estimatedArrival
          }
          
          // Update localStorage for demo users
          const isDemoUser = user?.id === '507f1f77bcf86cd799439011'
          if (isDemoUser) {
            localStorage.setItem('demo-active-ride', JSON.stringify(updatedRide))
          }
          
          return updatedRide
        })
      })
      
      // Listen for driver arrival
      const unsubscribeDriverArrived = onDriverArrived?.((data) => {
        console.log('Driver arrived:', data)
        
        setActiveRide(prev => {
          if (!prev) return prev
          
          const updatedRide = {
            ...prev,
            status: 'arrived' as const,
            statusDisplay: data.statusDisplay || 'Driver Arrived',
            estimatedArrival: 'Arrived at pickup location'
          }
          
          // Update localStorage for demo users
          const isDemoUser = user?.id === '507f1f77bcf86cd799439011'
          if (isDemoUser) {
            localStorage.setItem('demo-active-ride', JSON.stringify(updatedRide))
          }
          
          return updatedRide
        })
      })
      
      // Listen for ride status updates
      const unsubscribeStatusUpdate = onRideStatusUpdate?.((data) => {
        console.log('Ride status update:', data)
        
        setActiveRide(prev => {
          if (!prev) return prev
          
          const updatedRide = {
            ...prev,
            status: data.status,
            statusDisplay: data.statusDisplay,
            estimatedArrival: data.estimatedArrival || prev.estimatedArrival
          }
          
          // Update localStorage for demo users
          const isDemoUser = user?.id === '507f1f77bcf86cd799439011'
          if (isDemoUser) {
            localStorage.setItem('demo-active-ride', JSON.stringify(updatedRide))
          }
          
          return updatedRide
        })
      })
      
      // Cleanup function
      return () => {
        console.log('Cleaning up real-time tracking for ride:', activeRide.rideId)
        leaveRide(activeRide.rideId)
        unsubscribeLocationUpdate?.()
        unsubscribeDriverArrived?.()
        unsubscribeStatusUpdate?.()
      }
    }
  }, [activeRide, socketConnected, joinRide, leaveRide, onDriverLocationUpdate, onDriverArrived, onRideStatusUpdate, user?.id])

  // Persistence safeguard - restore ride if it gets cleared unexpectedly
  useEffect(() => {
    const isDemoUser = user?.id === '507f1f77bcf86cd799439011'
    if (isDemoUser && !activeRide) {
      // Small delay to avoid interference with other effects
      const timer = setTimeout(() => {
        try {
          const savedRide = localStorage.getItem('demo-active-ride')
          if (savedRide) {
            const rideData = JSON.parse(savedRide)
            if (rideData.status && rideData.status !== 'completed' && rideData.status !== 'cancelled') {
              console.log('🔄 Restoring ride state from localStorage')
              setActiveRide(rideData)
            }
          }
        } catch (error) {
          console.error('Error restoring ride state:', error)
        }
      }, 100)
      
      return () => clearTimeout(timer)
    }
  }, [activeRide, user?.id])

  // Cleanup simulation on unmount
  useEffect(() => {
    return () => {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current)
        simulationIntervalRef.current = null
        console.log('Cleaned up driver simulation on unmount')
      }
    }
  }, [])

  // Get user location when authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            })
            setLocationError(null)
          },
          (error) => {
            console.error('Error getting location:', error)
            setLocationError('Unable to access location. Please enable location services.')
            // Fallback to San Francisco
            setUserLocation({
              latitude: 37.7749,
              longitude: -122.4194
            })
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000
          }
        )
      } else {
        setLocationError('Geolocation not supported by this browser.')
        setUserLocation({
          latitude: 37.7749,
          longitude: -122.4194
        })
      }
    }
  }, [isAuthenticated, user])

  // Manual refresh function for debugging
  const refreshActiveRides = async () => {
    console.log('🔄 Manually refreshing rides for user:', user?.id)
    if (user) {
      const isDemoUser = user.id === '507f1f77bcf86cd799439011'
      
      if (isDemoUser) {
        try {
          const savedRide = localStorage.getItem('demo-active-ride')
          console.log('📱 Demo user localStorage check:', savedRide ? 'Found' : 'Empty')
          if (savedRide) {
            const rideData = JSON.parse(savedRide)
            if (rideData.status && rideData.status !== 'completed' && rideData.status !== 'cancelled') {
              console.log('✅ Restored demo ride')
              setActiveRide(rideData)
            } else {
              console.log('🗑️ Clearing old demo ride')
              localStorage.removeItem('demo-active-ride')
              setActiveRide(null)
            }
          } else {
            setActiveRide(null)
          }
        } catch (error) {
          console.error('Demo ride restore error:', error)
          localStorage.removeItem('demo-active-ride')
          setActiveRide(null)
        }
      } else {
        try {
          console.log('🌐 Fetching active rides from API...')
          const response = await fetch(`/api/rides?userId=${user.id}&status=active`)
          console.log('📡 API Response status:', response.status)
          
          if (response.ok) {
            const data = await response.json()
            console.log('📦 API Response data:', data)
            
            if (data.success && data.data.length > 0) {
              const rideData = data.data[0]
              console.log('✅ Found active ride in database:', rideData.rideId, rideData.status)
              
              const formattedRide = {
                id: rideData._id,
                rideId: rideData.rideId,
                pickupCode: rideData.pickupCode,
                status: rideData.status,
                statusDisplay: rideData.statusDisplay || 'Active Ride',
                pickup: rideData.pickup,
                destination: rideData.destination,
                driverContact: rideData.driverContact,
                driverLocation: rideData.driverLocation,
                pricing: rideData.pricing || { totalEstimated: 0 },
                carbonFootprint: rideData.carbonFootprint || { estimatedSaved: 0 },
                requestedAt: new Date(rideData.requestedAt),
                estimatedArrival: rideData.estimatedArrival
              }
              
              setActiveRide(formattedRide)
            } else {
              console.log('❌ No active rides found in database')
              setActiveRide(null)
            }
          } else {
            console.error('❌ API request failed:', response.status, response.statusText)
          }
        } catch (error) {
          console.error('❌ Network error checking active rides:', error)
        }
      }
    }
  }

  // Check for active rides and poll for updates
  useEffect(() => {
    const checkActiveRides = async () => {
      if (user) {
        const isDemoUser = user.id === '507f1f77bcf86cd799439011'
        
        if (isDemoUser) {
          // For demo users, only check localStorage once on load - don't keep polling
          if (!activeRide) {
            try {
              const savedRide = localStorage.getItem('demo-active-ride')
              if (savedRide) {
                const rideData = JSON.parse(savedRide)
                // Only restore active rides (not completed/cancelled)
                if (rideData.status && rideData.status !== 'completed' && rideData.status !== 'cancelled') {
                  setActiveRide(rideData)
                } else {
                  localStorage.removeItem('demo-active-ride')
                }
              }
            } catch (error) {
              localStorage.removeItem('demo-active-ride')
            }
          }
          return
        }
        
        try {
          const response = await fetch(`/api/rides?userId=${user.id}&status=active`)
          if (response.ok) {
            const data = await response.json()
            if (data.success && data.data.length > 0) {
              const rideData = data.data[0]
              console.log('✅ Found active ride in database:', rideData)
              
              // Convert database ride to frontend format
              const formattedRide = {
                id: rideData._id,
                rideId: rideData.rideId,
                pickupCode: rideData.pickupCode,
                status: rideData.status,
                statusDisplay: rideData.statusDisplay || 'Active Ride',
                pickup: rideData.pickup,
                destination: rideData.destination,
                driverContact: rideData.driverContact,
                driverLocation: rideData.driverLocation,
                pricing: rideData.pricing || { totalEstimated: 0 },
                carbonFootprint: rideData.carbonFootprint || { estimatedSaved: 0 },
                requestedAt: new Date(rideData.requestedAt),
                estimatedArrival: rideData.estimatedArrival
              }
              
              setActiveRide(formattedRide)
            } else {
              console.log('❌ No active rides found in database')
              setActiveRide(null)
            }
          } else {
            console.error('Failed to fetch rides:', response.status)
          }
        } catch (error) {
          console.error('Error checking active rides:', error)
        }
      }
    }

    if (isAuthenticated && user) {
      checkActiveRides()
      // Only poll for real users, not demo users
      const isDemoUser = user.id === '507f1f77bcf86cd799439011'
      if (!isDemoUser) {
        const interval = setInterval(checkActiveRides, 10000)
        return () => clearInterval(interval)
      }
    }
  }, [isAuthenticated, user])

  const clearActiveRide = async () => {
    if (!activeRide) return
    
    const isDemoUser = user?.id === '507f1f77bcf86cd799439011'
    
    if (isDemoUser) {
      setActiveRide(null)
      localStorage.removeItem('demo-active-ride')
      console.log('✅ Demo ride cleared from localStorage')
    } else {
      // Cancel real ride via the proper [rideId] API route
      try {
        const rideId = activeRide.id || activeRide._id
        console.log('🚫 Cancelling ride via [rideId] API:', rideId)
        
        // Use the [rideId] PATCH endpoint for proper cancellation
        const response = await fetch(`/api/rides/${rideId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            status: 'cancelled',
            userNote: 'Cancelled by user from frontend'
          })
        })
        
        if (response.ok) {
          const result = await response.json()
          console.log('✅ Ride cancelled successfully via API:', result.message)
          setActiveRide(null)
        } else {
          const errorData = await response.json()
          console.error('❌ Failed to cancel ride via API:', errorData.error?.message)
          // Force clear frontend state even if API fails
          setActiveRide(null)
        }
      } catch (error) {
        console.error('❌ Network error cancelling ride:', error)
        // Force clear frontend state even if API fails
        setActiveRide(null)
      }
    }
  }

  const handleBookRide = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user || !userLocation || !pickupAddress || !destinationAddress) {
      alert('Please fill in all fields and ensure location access is enabled')
      return
    }

    // Check if there's actually an active ride
    if (activeRide && activeRide.status !== 'completed' && activeRide.status !== 'cancelled') {
      const shouldContinue = confirm('You have an active ride. Do you want to cancel it and book a new one?')
      if (!shouldContinue) return
      
      // Clear the current active ride
      await clearActiveRide()
    }

    setIsBookingRide(true)

    try {
      const pickup = {
        address: pickupAddress,
        coordinates: userLocation
      }

      const destination = {
        address: destinationAddress,
        coordinates: {
          latitude: userLocation.latitude + (Math.random() - 0.5) * 0.1,
          longitude: userLocation.longitude + (Math.random() - 0.5) * 0.1
        }
      }

      // For demo user, create mock ride without API call
      const isDemoUser = user.id === '507f1f77bcf86cd799439011'
      
      if (isDemoUser) {
        console.log('Creating demo ride...')
        setShowBookingForm(false)
        setPickupAddress('')
        setDestinationAddress('')
        
        // Create mock ride data
        const mockRide = {
          id: 'demo-ride-' + Date.now(),
          rideId: 'DEMO-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
          pickupCode: Math.floor(100000 + Math.random() * 900000).toString(),
          status: 'requested',
          statusDisplay: 'Finding Driver...',
          pickup,
          destination,
          pricing: {
            totalEstimated: 15.50
          },
          carbonFootprint: {
            estimatedSaved: 2.3
          },
          requestedAt: new Date()
        }
        
        console.log('Mock ride created:', mockRide)
        console.log('Pickup coordinates:', pickup.coordinates)
        console.log('Destination coordinates:', destination.coordinates)
        
        // Immediately show driver matching
        setActiveRide(mockRide as any)
        // Save to localStorage for persistence
        localStorage.setItem('demo-active-ride', JSON.stringify(mockRide))
        
        // Then show driver details after 1.5 seconds
        setTimeout(() => {
          const driverStartLocation = {
            latitude: userLocation.latitude + 0.01,
            longitude: userLocation.longitude + 0.01
          }
          
          // Generate realistic demo driver data (not hardcoded)
          const demoDrivers = [
            {
              name: 'Alex Rodriguez',
              phone: '+1 (555) 247-8901',
              vehicleInfo: '2023 Honda Civic - Silver',
              licensePlate: 'HND-482',
              photo: 'https://i.pravatar.cc/150?u=alex-rodriguez'
            },
            {
              name: 'Sarah Kim',
              phone: '+1 (555) 391-2657',
              vehicleInfo: '2022 Toyota Prius - White',
              licensePlate: 'TOY-193',
              photo: 'https://i.pravatar.cc/150?u=sarah-kim'
            },
            {
              name: 'Marcus Johnson',
              phone: '+1 (555) 584-3726',
              vehicleInfo: '2024 Nissan Sentra - Blue',
              licensePlate: 'NSN-627',
              photo: 'https://i.pravatar.cc/150?u=marcus-johnson'
            }
          ]
          
          // Randomly select a demo driver
          const randomDriver = demoDrivers[Math.floor(Math.random() * demoDrivers.length)]
          
          const completedRide = {
            ...mockRide,
            status: 'matched',
            statusDisplay: 'Driver Found',
            driverContact: randomDriver,
            driverLocation: {
              coordinates: driverStartLocation,
              lastUpdated: new Date()
            },
            estimatedArrival: `${Math.floor(Math.random() * 8) + 3} minutes` // 3-10 minutes
          } as any
          
          // Persist the completed ride immediately
          setActiveRide(completedRide)
          localStorage.setItem('demo-active-ride', JSON.stringify(completedRide))
          
          // Start real-time driver simulation if socket is connected
          if (socketConnected && simulateDriverMovement) {
            console.log('Starting driver movement simulation...')
            
            // Clean up any previous simulation
            if (simulationIntervalRef.current) {
              clearInterval(simulationIntervalRef.current)
            }
            
            // Start new simulation
            const interval = simulateDriverMovement(
              mockRide.rideId,
              driverStartLocation,
              pickup.coordinates
            )
            
            if (interval) {
              simulationIntervalRef.current = interval
            }
          }
        }, 1500)
        
        setIsBookingRide(false)
        return
      }

      // For real users, use API
      const response = await fetch('/api/rides', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          pickup,
          destination,
          userNotes: '',
        }),
      })

      if (response.ok) {
        const result = await response.json()
        console.log('Ride booked successfully:', result)
        setShowBookingForm(false)
        setPickupAddress('')
        setDestinationAddress('')
        
        // Immediately show driver matching, then show driver details after 1 second (like Uber)
        setActiveRide({
          ...result.data,
          status: 'requested',
          statusDisplay: 'Finding Driver...',
        })
        
        // For real users, use actual database data if available
        setTimeout(async () => {
          try {
            // Try to fetch updated ride data from database
            const updatedResponse = await fetch(`/api/rides/${result.data.id}`)
            if (updatedResponse.ok) {
              const updatedData = await updatedResponse.json()
              if (updatedData.success) {
                console.log('✅ Using real driver data from database:', updatedData.data)
                
                // Convert database format to frontend format
                const formattedRide = {
                  id: updatedData.data._id,
                  rideId: updatedData.data.rideId,
                  pickupCode: updatedData.data.pickupCode,
                  status: updatedData.data.status,
                  statusDisplay: updatedData.data.statusDisplay || 'Driver Found',
                  pickup: updatedData.data.pickup,
                  destination: updatedData.data.destination,
                  driverContact: updatedData.data.driverContact,
                  driverLocation: updatedData.data.driverLocation,
                  pricing: updatedData.data.pricing || { totalEstimated: 0 },
                  carbonFootprint: updatedData.data.carbonFootprint || { estimatedSaved: 0 },
                  requestedAt: new Date(updatedData.data.requestedAt),
                  estimatedArrival: updatedData.data.estimatedArrival || '5 minutes'
                }
                
                setActiveRide(formattedRide)
                return
              }
            }
          } catch (error) {
            console.error('Failed to fetch updated ride data:', error)
          }
          
          // Fallback: show basic ride info from initial response
          console.log('⚠️ Using fallback ride data (no driver assigned yet)')
          setActiveRide({
            ...result.data,
            status: 'requested',
            statusDisplay: 'Searching for Driver...',
            estimatedArrival: 'Finding driver...'
          })
        }, 1500)
      } else {
        const errorData = await response.json()
        console.error('Booking failed:', errorData)
        
        // If user already has active ride, use the data from error response
        if (errorData.error?.code === 'ACTIVE_RIDE_EXISTS') {
          console.log('🔍 User has active ride - using data from API error response')
          
          if (errorData.error.activeRide) {
            const dbRide = errorData.error.activeRide
            console.log('✅ Found hidden active ride in error response:', dbRide)
            
            // Convert database ride to frontend format
            const formattedRide = {
              id: dbRide.id,
              rideId: dbRide.rideId,
              pickupCode: dbRide.pickupCode,
              status: dbRide.status,
              statusDisplay: dbRide.statusDisplay || 'Active Ride',
              pickup: dbRide.pickup,
              destination: dbRide.destination,
              driverContact: dbRide.driverContact,
              driverLocation: dbRide.driverLocation,
              pricing: dbRide.pricing || { totalEstimated: 0 },
              carbonFootprint: dbRide.carbonFootprint || { estimatedSaved: 0 },
              requestedAt: new Date(dbRide.requestedAt),
              estimatedArrival: dbRide.estimatedArrival
            }
            
            setActiveRide(formattedRide)
            setShowBookingForm(false)
            // Show a more user-friendly message
            setTimeout(() => {
              alert(`✅ Found your existing ride!\n\nRide ID: ${formattedRide.rideId}\nStatus: ${formattedRide.statusDisplay}\nPickup: ${formattedRide.pickup.address}`)
            }, 100)
            return
          } else {
            // Fallback: fetch manually if data not in error response
            console.log('🔍 No ride data in error - fetching manually...')
            try {
              const activeRideResponse = await fetch(`/api/rides?userId=${user.id}&status=active`)
              if (activeRideResponse.ok) {
                const rideData = await activeRideResponse.json()
                if (rideData.success && rideData.data.length > 0) {
                  const dbRide = rideData.data[0]
                  console.log('✅ Found active ride via manual fetch:', dbRide)
                  
                  const formattedRide = {
                    id: dbRide._id,
                    rideId: dbRide.rideId,
                    pickupCode: dbRide.pickupCode,
                    status: dbRide.status,
                    statusDisplay: dbRide.statusDisplay || 'Active Ride',
                    pickup: dbRide.pickup,
                    destination: dbRide.destination,
                    driverContact: dbRide.driverContact,
                    driverLocation: dbRide.driverLocation,
                    pricing: dbRide.pricing || { totalEstimated: 0 },
                    carbonFootprint: dbRide.carbonFootprint || { estimatedSaved: 0 },
                    requestedAt: new Date(dbRide.requestedAt),
                    estimatedArrival: dbRide.estimatedArrival
                  }
                  
                  setActiveRide(formattedRide)
                  setShowBookingForm(false)
                  alert('Found your existing ride! Displaying it now.')
                  return
                }
              }
            } catch (fetchError) {
              console.error('Failed to fetch active ride:', fetchError)
            }
          }
        }
        
        alert(errorData.error?.message || 'Failed to book ride')
      }
    } catch (error) {
      console.error('Error booking ride:', error)
      alert('Network error while booking ride')
    } finally {
      setIsBookingRide(false)
    }
  }

  const handleCancelRide = async () => {
    if (!activeRide) return
    
    const isDemoUser = user?.id === '507f1f77bcf86cd799439011'
    
    if (isDemoUser) {
      // For demo user, clear the active ride and localStorage
      await clearActiveRide()
      
      // Clean up any running simulation
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current)
        simulationIntervalRef.current = null
      }
      
      return
    }
    
    try {
      const rideId = activeRide.id || activeRide._id
      console.log('🚫 Cancelling ride via [rideId] API:', rideId)
      
      const response = await fetch(`/api/rides/${rideId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'cancelled',
          userNote: 'Cancelled by user via Cancel Ride button'
        }),
      })

      if (response.ok) {
        const result = await response.json()
        console.log('✅ Ride cancelled successfully:', result.message)
        setActiveRide(null)
      } else {
        const errorData = await response.json()
        console.error('❌ Failed to cancel ride:', errorData.error?.message)
      }
    } catch (error) {
      console.error('❌ Network error cancelling ride:', error)
    }
  }

  const callDriver = () => {
    if (activeRide?.driverContact?.phone) {
      window.location.href = `tel:${activeRide.driverContact.phone}`
    }
  }

  // Generate dynamic location suggestions based on user input
  const generateLocationSuggestions = (query: string) => {
    if (query.length < 2) return []
    
    // Create realistic suggestions based on input
    return [
      `${query} Street, New York, NY`,
      `${query} Avenue, Los Angeles, CA`,
      `${query} Road, Chicago, IL`,
      `${query} Boulevard, Miami, FL`,
      `${query} Plaza, San Francisco, CA`
    ]
  }

  const handlePickupSearch = (value: string) => {
    setPickupAddress(value)
    if (value.length > 2) {
      const suggestions = generateLocationSuggestions(value)
      setPickupSuggestions(suggestions)
      setShowPickupSuggestions(true)
    } else {
      setShowPickupSuggestions(false)
    }
  }

  const handleDestinationSearch = (value: string) => {
    setDestinationAddress(value)
    if (value.length > 2) {
      const suggestions = generateLocationSuggestions(value)
      setDestinationSuggestions(suggestions)
      setShowDestinationSuggestions(true)
    } else {
      setShowDestinationSuggestions(false)
    }
  }

  const selectPickupSuggestion = (suggestion: string) => {
    setPickupAddress(suggestion)
    setShowPickupSuggestions(false)
  }

  const selectDestinationSuggestion = (suggestion: string) => {
    setDestinationAddress(suggestion)
    setShowDestinationSuggestions(false)
  }

  // Hide suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowPickupSuggestions(false)
      setShowDestinationSuggestions(false)
    }
    
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  // Show loading if still checking auth
  if (isLoading || status === 'loading') {
    return (
      <div className="min-h-screen gradient-dark flex items-center justify-center relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-primary-500 rounded-full opacity-10 animate-float"></div>
          <div className="absolute top-3/4 right-1/4 w-24 h-24 bg-secondary-500 rounded-full opacity-10 animate-float" style={{animationDelay: '1s'}}></div>
          <div className="absolute bottom-1/4 left-1/3 w-40 h-40 bg-primary-600 rounded-full opacity-10 animate-float" style={{animationDelay: '2s'}}></div>
        </div>
        
        <div className="text-center relative z-10 animate-scale-in">
          <div className="relative">
            <div className="animate-pulse-glow rounded-full h-16 w-16 border-4 border-primary-500 border-t-transparent mx-auto mb-6 animate-spin"></div>
            <div className="absolute inset-0 h-16 w-16 border-4 border-secondary-500 border-t-transparent mx-auto rounded-full animate-spin" style={{animationDirection: 'reverse', animationDuration: '1.5s'}}></div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2 animate-fade-in">GoCab</h2>
          <p className="text-primary-300 animate-fade-in">Preparing your ride...</p>
        </div>
      </div>
    )
  }

  // Show authentication page if not logged in
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen gradient-dark relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary-900/20 to-secondary-900/20"></div>
          <div className="absolute top-1/4 -left-32 w-64 h-64 bg-primary-500 rounded-full opacity-5 animate-float"></div>
          <div className="absolute top-3/4 -right-32 w-96 h-96 bg-secondary-500 rounded-full opacity-5 animate-float" style={{animationDelay: '2s'}}></div>
          <div className="absolute bottom-0 left-1/2 w-80 h-80 bg-primary-600 rounded-full opacity-5 animate-float" style={{animationDelay: '4s'}}></div>
          
          {/* Floating particles */}
          <div className="absolute top-1/6 left-1/6 w-2 h-2 bg-secondary-400 rounded-full animate-float opacity-50"></div>
          <div className="absolute top-2/3 left-1/12 w-1 h-1 bg-primary-400 rounded-full animate-float opacity-60" style={{animationDelay: '1s'}}></div>
          <div className="absolute top-1/3 right-1/6 w-3 h-3 bg-secondary-300 rounded-full animate-float opacity-40" style={{animationDelay: '3s'}}></div>
        </div>

        <div className="container mx-auto px-4 py-8 relative z-10">
          {/* Header */}
          <header className="text-center mb-12 animate-slide-down">
            <div className="inline-block relative">
              <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 relative">
                <span className="inline-block animate-fade-in">Go</span>
                <span className="text-primary-400 inline-block animate-fade-in shimmer-effect" style={{animationDelay: '0.3s'}}>Cab</span>
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-secondary-500 rounded-full animate-pulse opacity-75"></div>
              </h1>
            </div>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto animate-fade-in leading-relaxed" style={{animationDelay: '0.6s'}}>
              Your <span className="text-primary-400 font-semibold">eco-friendly</span> ride is just a tap away. 
              Track your <span className="text-secondary-400 font-semibold">carbon savings</span> while cruising through the city.
            </p>
            
            {/* Error Display */}
            {error && (
              <div className="mt-6 inline-flex items-center bg-red-900/20 border border-red-500/30 text-red-300 px-6 py-3 rounded-2xl backdrop-blur-sm animate-scale-in">
                <span className="mr-3 text-xl">⚠️</span>
                <span className="font-medium">{error}</span>
              </div>
            )}
          </header>

          {/* Car Animation */}
          <div className="relative mb-12 h-32 overflow-hidden">
            <div className="absolute inset-0 flex items-center">
              <div className="animate-[slideInCar_3s_ease-in-out] w-full">
                <div className="flex justify-center items-center space-x-4">
                  <div className="text-6xl animate-[carMove_3s_ease-in-out]">🚗</div>
                  <div className="animate-[fadeInText_3s_ease-in-out_1s_both] opacity-0">
                    <span className="text-4xl font-bold text-white">Go</span>
                    <span className="text-4xl font-bold text-primary-400">Cab</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Minimalist Login Options */}
          <div className="max-w-sm mx-auto animate-[fadeInUp_0.8s_ease-out_2.5s_both] opacity-0">
            <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-6 hover:bg-white/10 transition-all duration-300">
              <h2 className="text-xl font-medium text-white mb-6 text-center">Ready to ride?</h2>
              
              <div className="space-y-3">
                <button 
                  className="w-full bg-white text-dark-800 font-medium py-3 px-6 rounded-xl transition-all duration-300 hover:bg-gray-100 hover:shadow-lg flex items-center justify-center space-x-3"
                  disabled={isLoading}
                  onClick={() => {
                    console.log('Sign In with Google button clicked!')
                    signIn()
                  }}
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
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-6 rounded-xl transition-all duration-300 hover:shadow-lg"
                  disabled={isLoading}
                  onClick={demoSignIn}
                >
                  {isLoading ? 'Loading...' : 'Try Demo'}
                </button>
              </div>
              
              <p className="text-center text-xs text-gray-400 mt-4">
                Demo mode for instant access
              </p>
            </div>
          </div>

          {/* Features Preview */}
          <div className="grid md:grid-cols-3 gap-8 mt-20 max-w-5xl mx-auto">
            {[
              { 
                emoji: '🚗', 
                title: 'Instant Booking', 
                description: 'Book your ride in seconds with smart location detection',
                delay: '1.2s',
                gradient: 'from-primary-600 to-primary-800'
              },
              { 
                emoji: '🌱', 
                title: 'Carbon Tracking', 
                description: 'Monitor your environmental impact and savings',
                delay: '1.5s',
                gradient: 'from-secondary-600 to-secondary-800'
              },
              { 
                emoji: '📱', 
                title: 'Live Tracking', 
                description: 'Real-time driver location and ETA updates',
                delay: '1.8s',
                gradient: 'from-primary-700 to-dark-800'
              }
            ].map((feature, index) => (
              <div 
                key={index}
                className="group bg-white/5 backdrop-blur-sm rounded-3xl shadow-xl border border-white/10 p-8 text-center hover:bg-white/10 transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 animate-scale-in"
                style={{animationDelay: feature.delay}}
              >
                <div className={`w-16 h-16 bg-gradient-to-br ${feature.gradient} rounded-2xl mx-auto mb-6 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                  <span className="text-3xl">{feature.emoji}</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3 group-hover:text-primary-300 transition-colors duration-300">
                  {feature.title}
                </h3>
                <p className="text-gray-300 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="text-center mt-16 animate-fade-in" style={{animationDelay: '2.1s'}}>
            <p className="text-gray-400 text-lg">
              Join the <span className="text-primary-400 font-semibold">eco-friendly</span> transportation revolution 🌍
            </p>
          </div>
        </div>
      </main>
    )
  }

  // Main Uber-like interface when authenticated
  const mapCenter = userLocation || { latitude: 37.7749, longitude: -122.4194 }
  
  // Debug logging
  console.log('Current activeRide:', activeRide)
  console.log('Map center:', mapCenter)

  return (
    <div className="relative h-screen w-full overflow-hidden gradient-dark">
      
      {/* Full Screen Map - Lower z-index */}
      <div 
        className="absolute inset-0" 
        style={{ 
          zIndex: 1,
          isolation: 'isolate'
        }}
      >
        <MapView 
          center={[mapCenter.latitude, mapCenter.longitude]} 
          zoom={13}
          pickupLocation={activeRide?.pickup ? {
            latitude: activeRide.pickup.coordinates.latitude,
            longitude: activeRide.pickup.coordinates.longitude,
            address: activeRide.pickup.address
          } : undefined}
          dropLocation={activeRide?.destination ? {
            latitude: activeRide.destination.coordinates.latitude,
            longitude: activeRide.destination.coordinates.longitude,
            address: activeRide.destination.address
          } : undefined}
          driverLocation={activeRide?.driverLocation ? {
            latitude: activeRide.driverLocation.coordinates.latitude,
            longitude: activeRide.driverLocation.coordinates.longitude
          } : undefined}
          showRoute={!!activeRide}
        />
      </div>

      {/* Top Header with Glass Effect */}
      <div 
        className="absolute top-0 left-0 right-0 bg-black/20 backdrop-blur-lg border-b border-white/10 animate-slide-down"
        style={{ zIndex: 9999 }}
      >
        <div className="flex justify-between items-center px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-lg">G</span>
            </div>
            <h1 className="text-xl font-bold text-white">
              Go<span className="text-primary-400">Cab</span>
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary-500/20 rounded-full flex items-center justify-center">
                <span className="text-primary-400 text-sm">👋</span>
              </div>
              <span className="text-white font-medium">Hi, {user?.firstName}!</span>
            </div>
            <button 
              onClick={() => window.location.href = '/events'}
              className="bg-secondary-500/20 hover:bg-secondary-500/30 text-secondary-400 hover:text-secondary-300 font-medium px-4 py-2 rounded-xl transition-all duration-300 transform hover:scale-105"
            >
              🎫 Events
            </button>
            <button 
              onClick={refreshActiveRides}
              className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 hover:text-blue-300 font-medium px-3 py-2 rounded-xl transition-all duration-300 transform hover:scale-105 text-xs"
              title="Manually refresh ride status"
            >
              🔄 Refresh
            </button>
            <button 
              onClick={async () => {
                // Cancel any active ride before signing out
                if (activeRide) {
                  // Show user that ride is being cancelled
                  const userConfirmed = confirm(
                    `You have an active ride (${activeRide.rideId}). It will be cancelled when you sign out. Continue?`
                  )
                  
                  if (!userConfirmed) return
                  
                  const isDemoUser = user?.id === '507f1f77bcf86cd799439011'
                  
                  // Cancel active ride (handles both demo and real users)
                  await clearActiveRide()
                  
                  // Stop any running simulation for demo users
                  if (isDemoUser && simulationIntervalRef.current) {
                    clearInterval(simulationIntervalRef.current)
                    simulationIntervalRef.current = null
                  }
                }
                
                // Then sign out
                signOut()
              }}
              className="bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 font-medium px-4 py-2 rounded-xl transition-all duration-300 transform hover:scale-105"
            >
              🚪 Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Location Error Alert */}
      {locationError && (
        <div 
          className="absolute top-20 left-4 right-4 bg-red-900/80 backdrop-blur-lg border border-red-500/30 text-red-100 p-4 rounded-2xl shadow-2xl animate-slide-down"
          style={{ zIndex: 9998 }}
        >
          <div className="flex items-center space-x-3">
            <div className="w-5 h-5 bg-red-500 rounded-full"></div>
            <p className="text-sm font-medium">{locationError}</p>
          </div>
        </div>
      )}

      {/* Active Ride Status */}
      {activeRide ? (
        <div 
          className="absolute bottom-0 left-0 right-0 animate-slide-up"
          style={{ zIndex: 9997 }}
        >
          
          {/* Finding Driver State */}
          {activeRide.status === 'requested' ? (
            <div className="bg-white/95 backdrop-blur-lg rounded-t-3xl shadow-2xl p-8 border-t-4 border-secondary-500">
              <div className="text-center">
                <div className="w-16 h-16 gradient-secondary rounded-2xl mx-auto mb-4 flex items-center justify-center animate-pulse">
                  <span className="text-3xl">🔍</span>
                </div>
                <h3 className="text-xl font-bold text-dark-800 mb-2">{activeRide.statusDisplay}</h3>
                <p className="text-dark-600 mb-6">We're matching you with the best driver nearby...</p>
                
                <div className="flex justify-center mb-4">
                  <div className="flex space-x-1">
                    <div className="w-3 h-3 bg-primary-500 rounded-full animate-bounce"></div>
                    <div className="w-3 h-3 bg-primary-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-3 h-3 bg-primary-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
                
                <button
                  onClick={handleCancelRide}
                  className="bg-gray-200 hover:bg-gray-300 text-dark-700 py-3 px-6 rounded-xl font-medium transition-all duration-300"
                >
                  Cancel Request
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Pickup Code Banner */}
              <div className="gradient-primary text-white text-center py-6 px-4 shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-black/10"></div>
                <div className="relative z-10">
                  <p className="text-sm font-semibold mb-2 opacity-90">Your Pickup Code</p>
                  <p className="text-4xl font-bold tracking-[0.3em] mb-2 animate-pulse-glow">{activeRide.pickupCode}</p>
                  <p className="text-sm opacity-80">Share this code with your driver for verification</p>
                </div>
                <div className="absolute top-0 left-0 w-full h-1 bg-secondary-400 animate-shimmer"></div>
              </div>

          {/* Enhanced Driver Info Card */}
          <div className="bg-white/95 backdrop-blur-lg rounded-t-3xl shadow-2xl p-6 max-h-96 overflow-y-auto border-t-4 border-primary-500">
            
            {/* Driver Header */}
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <div className="w-16 h-16 gradient-primary rounded-2xl overflow-hidden shadow-lg">
                    {activeRide.driverContact?.photo ? (
                      <img 
                        src={activeRide.driverContact.photo} 
                        alt="Driver" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-white text-2xl">👨‍💼</span>
                      </div>
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-xl text-dark-800">{activeRide.driverContact?.name || 'Driver'}</h3>
                  <div className="flex items-center space-x-2 mt-1">
                    <div className="w-5 h-5 bg-primary-500 rounded-lg"></div>
                    <p className="text-dark-600 font-medium">{activeRide.driverContact?.vehicleInfo}</p>
                  </div>
                  <div className="flex items-center space-x-2 mt-1">
                    <div className="w-5 h-5 bg-gray-500 rounded"></div>
                    <p className="text-dark-700 font-bold text-lg">{activeRide.driverContact?.licensePlate}</p>
                  </div>
                  <div className="flex items-center space-x-2 mt-1">
                    <div className="w-5 h-5 bg-green-500 rounded-full"></div>
                    <p className="text-primary-600 font-medium">{activeRide.driverContact?.phone}</p>
                  </div>
                </div>
              </div>
              <div className="text-center">
                <span className={`px-4 py-2 rounded-2xl text-sm font-bold shadow-lg ${
                  activeRide.status === 'matched' ? 'bg-primary-100 text-primary-800 border border-primary-300' :
                  activeRide.status === 'driver_en_route' ? 'bg-purple-100 text-purple-800 border border-purple-300' :
                  activeRide.status === 'arrived' ? 'bg-green-100 text-green-800 border border-green-300' :
                  activeRide.status === 'in_progress' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                  'bg-orange-100 text-orange-800 border border-orange-300'
                }`}>
                  {activeRide.statusDisplay}
                </span>
              </div>
            </div>

            {/* ETA Banner */}
            {activeRide.estimatedArrival && (
              <div className="gradient-secondary text-dark-900 rounded-2xl p-4 mb-6 relative overflow-hidden shadow-lg animate-pulse-glow">
                <div className="flex items-center justify-center space-x-3">
                  <span className="text-2xl">⏱️</span>
                  <div className="text-center">
                    <p className="text-sm font-semibold opacity-80">Driver arriving in</p>
                    <p className="text-2xl font-bold">{activeRide.estimatedArrival}</p>
                  </div>
                  <div className="w-8 h-8 bg-primary-500 rounded-full animate-pulse"></div>
                </div>
              </div>
            )}

            {/* Trip Route */}
            <div className="space-y-4 mb-6">
              <div className="flex items-center space-x-4 p-3 bg-primary-50 rounded-2xl border border-primary-200">
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-primary-700 uppercase tracking-wide">Pickup Location</p>
                  <p className="font-bold text-dark-800">{activeRide.pickup.address}</p>
                </div>
              </div>
              
              <div className="flex justify-center">
                <div className="w-px h-6 bg-gradient-to-b from-blue-500 to-red-500"></div>
              </div>
              
              <div className="flex items-center space-x-4 p-3 bg-red-50 rounded-2xl border border-red-200">
                <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-white text-xs font-bold">🎯</span>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Destination</p>
                  <p className="font-bold text-dark-800">{activeRide.destination.address}</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <button
                onClick={callDriver}
                className="gradient-primary text-white py-4 px-6 rounded-2xl font-bold text-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center justify-center space-x-2"
              >
                <div className="w-5 h-5 bg-white rounded-full"></div>
                <span>Call Driver</span>
              </button>
              <button
                onClick={handleCancelRide}
                className="bg-red-600 hover:bg-red-700 text-white py-4 px-6 rounded-2xl font-bold text-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95"
              >
                Cancel Ride
              </button>
            </div>
            
            {/* Complete Ride Button - shown when driver arrived */}
            {activeRide.status === 'arrived' && (
              <button
                onClick={async () => {
                  await clearActiveRide()
                  
                  // Clean up simulation for demo users
                  const isDemoUser = user?.id === '507f1f77bcf86cd799439011'
                  if (isDemoUser && simulationIntervalRef.current) {
                    clearInterval(simulationIntervalRef.current)
                    simulationIntervalRef.current = null
                  }
                }}
                className="w-full gradient-secondary text-dark-900 py-4 px-6 rounded-2xl font-bold text-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 mb-4"
              >
                🎉 Complete Ride
              </button>
            )}
            
            {/* Debug: Manual ride clear for real users */}
            {user?.id !== '507f1f77bcf86cd799439011' && (
              <button
                onClick={clearActiveRide}
                className="w-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-700 py-2 px-4 rounded-xl text-sm font-medium hover:bg-yellow-500/30 transition-all duration-300 mb-4"
              >
                🧹 Clear Stale Ride (Debug)
              </button>
            )}

            {/* Carbon Impact */}
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <div className="w-6 h-6 bg-green-500 rounded-full"></div>
                <span className="text-lg font-bold text-green-700">Eco Impact</span>
              </div>
              <p className="text-sm text-green-600">
                You'll save <span className="font-bold text-xl text-green-700">{activeRide.carbonFootprint.estimatedSaved}kg CO₂</span> with this sustainable ride!
              </p>
            </div>
          </div>
            </>
          )}
        </div>
      ) : (
        /* Book Ride Button & Form - Only show when no active ride */
        !activeRide ? (
          <div 
            className="absolute bottom-6 left-4 right-4"
            style={{ zIndex: 9997 }}
          >
            
            {showBookingForm ? (
            /* Enhanced Booking Form */
            <div className="bg-white/95 backdrop-blur-lg rounded-3xl shadow-2xl p-6 border border-white/20 animate-slide-up">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center">
                    <div className="w-5 h-5 bg-white rounded-lg"></div>
                  </div>
                  <h2 className="text-xl font-bold text-dark-800">Book Your Ride</h2>
                </div>
                <button
                  onClick={() => setShowBookingForm(false)}
                  className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110"
                >
                  <span className="text-gray-600 text-xl">✕</span>
                </button>
              </div>
              
              <form onSubmit={handleBookRide} className="space-y-5">
                {/* Pickup Location */}
                <div className="relative">
                  <label className="block text-sm font-bold text-dark-700 mb-2 flex items-center space-x-2">
                    <span className="w-4 h-4 bg-blue-500 rounded-full"></span>
                    <span>Pickup Location</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={pickupAddress}
                      onChange={(e) => handlePickupSearch(e.target.value)}
                      onFocus={() => pickupAddress.length > 2 && setShowPickupSuggestions(true)}
                      placeholder="Enter pickup address..."
                      className="w-full p-4 pl-12 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 text-dark-800 placeholder-gray-400 font-medium"
                      required
                    />
                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    </div>
                    
                    {/* Pickup Suggestions */}
                    {showPickupSuggestions && pickupSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-2xl shadow-lg mt-1 max-h-48 overflow-y-auto" style={{ zIndex: 10001 }}>
                        {pickupSuggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => selectPickupSuggestion(suggestion)}
                            className="w-full text-left p-3 hover:bg-blue-50 flex items-center space-x-3 transition-colors"
                          >
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <span className="text-dark-700">{suggestion}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button 
                    type="button"
                    onClick={() => {
                      if (userLocation) {
                        setPickupAddress('Current Location')
                        setShowPickupSuggestions(false)
                      }
                    }}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1"
                  >
                    <span>🎯</span>
                    <span>Use current location</span>
                  </button>
                </div>

                {/* Destination */}
                <div className="relative">
                  <label className="block text-sm font-bold text-dark-700 mb-2 flex items-center space-x-2">
                    <span className="w-4 h-4 bg-red-500 rounded-full"></span>
                    <span>Destination</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={destinationAddress}
                      onChange={(e) => handleDestinationSearch(e.target.value)}
                      onFocus={() => destinationAddress.length > 2 && setShowDestinationSuggestions(true)}
                      placeholder="Where do you want to go?"
                      className="w-full p-4 pl-12 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-300 text-dark-800 placeholder-gray-400 font-medium"
                      required
                    />
                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    </div>
                    
                    {/* Destination Suggestions */}
                    {showDestinationSuggestions && destinationSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-2xl shadow-lg mt-1 max-h-48 overflow-y-auto" style={{ zIndex: 10001 }}>
                        {destinationSuggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => selectDestinationSuggestion(suggestion)}
                            className="w-full text-left p-3 hover:bg-red-50 flex items-center space-x-3 transition-colors"
                          >
                            <span className="text-red-500">🎯</span>
                            <span className="text-dark-700">{suggestion}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button 
                    type="button"
                    className="mt-2 text-sm text-red-600 hover:text-red-700 font-medium flex items-center space-x-1"
                  >
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span>Choose on map</span>
                  </button>
                </div>

                {/* Ride Options */}
                <div className="bg-gradient-to-r from-primary-50 to-secondary-50 rounded-2xl p-4 border border-primary-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                        <div className="w-3 h-3 bg-white rounded-full"></div>
                      </div>
                      <div>
                        <p className="font-bold text-dark-800">Eco-Friendly Ride</p>
                        <p className="text-sm text-dark-600">Carbon neutral transportation</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary-700">$12-15</p>
                      <p className="text-xs text-dark-600">Estimated</p>
                    </div>
                  </div>
                </div>

                {/* Book Button */}
                <button
                  type="submit"
                  disabled={isBookingRide || !userLocation}
                  className="w-full gradient-primary text-white py-5 px-6 rounded-2xl font-bold text-lg hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 active:scale-95 relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                  <span className="relative flex items-center justify-center space-x-3">
                    {isBookingRide ? (
                      <>
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                        <span>Finding Your Driver...</span>
                      </>
                    ) : (
                      <>
                        <span className="text-2xl">🚀</span>
                        <span>Book GoCab Now</span>
                        <span className="text-2xl">🌟</span>
                      </>
                    )}
                  </span>
                </button>
              </form>
              
              {/* Footer Info */}
              <div className="mt-4 text-center">
                <p className="text-xs text-gray-500">
                  💡 Instant matching • 🔒 Secure pickup codes • 🌍 Carbon tracking
                </p>
              </div>
            </div>
          ) : (
            /* Stunning Where to? Button */
            <div className="relative">
              <button
                onClick={() => setShowBookingForm(true)}
                className="w-full gradient-dark text-white py-6 px-8 rounded-3xl font-bold text-xl shadow-2xl hover:shadow-3xl transition-all duration-500 transform hover:scale-105 active:scale-95 relative overflow-hidden group border-2 border-white/20 backdrop-blur-sm animate-scale-in"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary-600/20 to-secondary-600/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                <div className="relative flex items-center justify-center space-x-4">
                  <span className="tracking-wide text-2xl font-semibold">Where to?</span>
                </div>
                <div className="absolute top-2 right-2 w-3 h-3 bg-primary-400 rounded-full animate-pulse"></div>
                <div className="absolute bottom-2 left-2 w-2 h-2 bg-secondary-400 rounded-full animate-pulse" style={{animationDelay: '0.5s'}}></div>
              </button>
              
              {/* Floating hint */}
              <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 animate-fade-in">
                <div className="bg-white/90 backdrop-blur-sm text-dark-800 px-4 py-2 rounded-2xl shadow-lg text-sm font-medium">
                  👆 Tap to start your eco-friendly journey
                </div>
              </div>
            </div>
          )}
          </div>
                  ) : null
      )}

      {/* Floating Location Indicator */}
      {userLocation && (
        <div 
          className="absolute bottom-32 right-4 animate-scale-in"
          style={{ zIndex: 9996 }}
        >
          <button className="bg-white/90 backdrop-blur-lg p-4 rounded-2xl shadow-2xl hover:shadow-3xl border border-white/20 transition-all duration-300 transform hover:scale-110 group">
            <div className="relative">
              <div className="w-6 h-6 bg-primary-600 rounded-full group-hover:scale-110 transition-transform duration-300"></div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary-500 rounded-full animate-pulse"></div>
            </div>
          </button>
        </div>
      )}

      {/* Status Indicator */}
      <div 
        className="absolute top-20 right-4 bg-primary-600/80 backdrop-blur-sm text-white px-3 py-2 rounded-xl text-xs font-bold animate-fade-in border border-primary-400/30"
        style={{ zIndex: 10000 }}
      >
        🟢 Live
      </div>

      {/* Real-time Connection Status */}
      {activeRide && (
        <div 
          className={`absolute top-20 left-4 px-3 py-2 rounded-xl text-xs font-bold animate-fade-in border transition-all duration-300 ${
            socketConnected 
              ? 'bg-green-600/80 backdrop-blur-sm text-white border-green-400/30 animate-pulse' 
              : 'bg-yellow-600/80 backdrop-blur-sm text-white border-yellow-400/30'
          }`}
          style={{ zIndex: 10000 }}
        >
          {socketConnected ? (
            <>Live Tracking</>
          ) : (
            <>Connecting</>
          )}
        </div>
      )}

      {/* Socket Error Alert */}
      {socketError && (
        <div 
          className="absolute top-32 left-1/2 transform -translate-x-1/2 bg-red-900/80 backdrop-blur-lg text-white px-4 py-2 rounded-xl shadow-xl animate-slide-down"
          style={{ zIndex: 10000 }}
        >
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-yellow-400 rounded-full"></div>
            <span className="text-xs font-medium">Real-time service unavailable</span>
          </div>
        </div>
      )}
    </div>
  )
}
