'use client'

import { useEffect, useState } from 'react'
import { useGoCabAuth } from '@/lib/auth/use-gocab-auth-google'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { usePusher } from '@/lib/hooks/use-pusher'
import MapView from '@/components/Map/MapView'

interface DriverLocation {
  latitude: number
  longitude: number
  lastUpdate: Date
}

interface RideRequest {
  id: string
  rideId: string
  otp: string
  pickupAddress: string
  destinationAddress: string
  pickupCoordinates: { latitude: number, longitude: number }
  estimatedFare: number
  distanceToPickup: number
  passengerName: string
  requestedAt: Date
  estimatedTimeToPickup?: string
}

export default function DriverDashboard() {
  const { isAuthenticated, user, isLoading, signOut } = useGoCabAuth()
  const { status } = useSession()
  const router = useRouter()
  const { 
    isConnected, 
    connectionError, 
    joinAsDriver, 
    onNewRide, 
    onNotificationSound,
    updateDriverLocation 
  } = usePusher()
  
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null)
  const [rideRequests, setRideRequests] = useState<RideRequest[]>([])
  const [acceptedRide, setAcceptedRide] = useState<any>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false)
  const [previousRequestCount, setPreviousRequestCount] = useState(0)
  const [isProcessingRide, setIsProcessingRide] = useState(false)
  const [activeNotification, setActiveNotification] = useState<RideRequest | null>(null)
  const [notificationTimeLeft, setNotificationTimeLeft] = useState(0)

  // Redirect if not authenticated
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isLoading && !isAuthenticated) {
        console.log('🚨 Driver not authenticated, redirecting to home')
        router.push('/')
      }
    }, 100)
    
    return () => clearTimeout(timer)
  }, [isAuthenticated, isLoading, router])

  // Auto-start location sharing when authenticated
  useEffect(() => {
    let locationInterval: NodeJS.Timeout

    if (isAuthenticated && user?.id) {
      const updateLocation = () => {
        if ('geolocation' in navigator) {
          setIsUpdatingLocation(true)
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const newLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                lastUpdate: new Date()
              }
              
              // Update local state
              setDriverLocation(newLocation)
              
              // Send to server
              try {
                // Update general driver location
                await fetch('/api/drivers/location', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    driverId: user.id,
                    location: {
                      latitude: newLocation.latitude,
                      longitude: newLocation.longitude
                    }
                  })
                })

                // If driver has an accepted ride, also update ride-specific location
                if (acceptedRide) {
                  await fetch(`/api/rides/${acceptedRide.rideId}/location`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      driverId: user.id,
                      location: {
                        latitude: newLocation.latitude,
                        longitude: newLocation.longitude
                      }
                    })
                  })
                  console.log('📍 Updated ride location for tracking')
                }
                
                setLocationError(null)
              } catch (error) {
                console.error('Failed to update location:', error)
                setLocationError('Failed to update location')
              } finally {
                setIsUpdatingLocation(false)
              }
            },
            (error) => {
              console.error('Geolocation error:', error)
              setLocationError('Unable to access location. Please enable location services.')
              setIsUpdatingLocation(false)
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 30000
            }
          )
        }
      }

      // Update immediately and then every 5 seconds
      updateLocation()
      locationInterval = setInterval(updateLocation, 5000)
    }

    return () => {
      if (locationInterval) clearInterval(locationInterval)
    }
  }, [isAuthenticated, user?.id, acceptedRide])

  // WebSocket connection and real-time notifications
  useEffect(() => {
    if (isAuthenticated && user?.id && isConnected) {
      console.log('🚗 Driver joining WebSocket as:', user.id)
      joinAsDriver(user.id)
      
      // Listen for new ride notifications
      const unsubscribeNewRides = onNewRide((rideData: any) => {
        console.log('🎯 New ride notification received:', rideData)
        
        const newRequest: RideRequest = {
          id: rideData.id,
          rideId: rideData.rideId,
          otp: rideData.otp,
          pickupAddress: rideData.pickup?.address || 'Unknown pickup',
          destinationAddress: rideData.destination?.address || 'Unknown destination',
          pickupCoordinates: rideData.pickup?.coordinates || { latitude: 0, longitude: 0 },
          estimatedFare: rideData.pricing?.totalEstimated || 0,
          distanceToPickup: rideData.distanceToPickup || 0,
          passengerName: 'Passenger',
          requestedAt: new Date(rideData.requestedAt),
          estimatedTimeToPickup: rideData.estimatedTimeToPickup
        }
        
        // Add to ride requests if not already present
        setRideRequests(prev => {
          const exists = prev.some(req => req.id === newRequest.id)
          if (!exists) {
            console.log('✅ Adding new ride request to list')
            return [...prev, newRequest]
          }
          return prev
        })
        
        // Show persistent notification for the new ride
        if (!activeNotification) {
          console.log('🚨 Showing persistent notification for new ride')
          setActiveNotification(newRequest)
          setNotificationTimeLeft(120) // 2 minutes to respond
        }
      })
      
      // Listen for notification sounds
      const unsubscribeSound = onNotificationSound(() => {
        console.log('🔔 Playing notification sound')
        playNotificationSound()
      })
      
      return () => {
        console.log('🧹 Cleaning up WebSocket listeners')
        unsubscribeNewRides()
        unsubscribeSound()
      }
    }
  }, [isAuthenticated, user?.id, isConnected, joinAsDriver, onNewRide, onNotificationSound, activeNotification])

  // Fallback polling when WebSocket is not connected (reduced frequency)
  useEffect(() => {
    let requestInterval: NodeJS.Timeout

    // Only use polling as fallback when WebSocket is not connected
    if (driverLocation && user?.id && !isConnected) {
      console.log('⚠️ WebSocket not connected, using polling fallback')
      
      const fetchAvailableRides = async () => {
        try {
          const response = await fetch(
            `/api/drivers/available-rides?driverId=${user.id}&lat=${driverLocation.latitude}&lng=${driverLocation.longitude}&maxDistance=5000`
          )
          if (response.ok) {
            const data = await response.json()
            if (data.success) {
              const newRequests = data.data.map((ride: any) => ({
                id: ride.id,
                rideId: ride.rideId,
                otp: ride.otp,
                pickupAddress: ride.pickup?.address || 'Unknown pickup',
                destinationAddress: ride.destination?.address || 'Unknown destination',
                pickupCoordinates: ride.pickup?.coordinates || { latitude: 0, longitude: 0 },
                estimatedFare: ride.pricing?.totalEstimated || 0,
                distanceToPickup: ride.distanceToPickup || 0,
                passengerName: 'Passenger',
                requestedAt: new Date(ride.requestedAt),
                estimatedTimeToPickup: ride.estimatedTimeToPickup
              }))
              
              // Play notification sound if there are new ride requests
              if (newRequests.length > previousRequestCount && previousRequestCount > 0) {
                playNotificationSound()
              }
              
              setRideRequests(newRequests)
              setPreviousRequestCount(newRequests.length)
            }
          }
        } catch (error) {
          console.error('Failed to fetch available rides:', error)
        }
      }

      // Fetch immediately and then every 3 seconds (faster fallback)
      fetchAvailableRides()
      requestInterval = setInterval(fetchAvailableRides, 3000)
    } else if (isConnected) {
      // Clear polling when WebSocket is connected
      console.log('✅ WebSocket connected, disabling polling fallback')
      setRideRequests([]) // Clear old polling results, WebSocket will populate
      setPreviousRequestCount(0)
    }

    return () => {
      if (requestInterval) clearInterval(requestInterval)
    }
  }, [driverLocation, user?.id, isConnected, previousRequestCount])

  // Notification countdown timer
  useEffect(() => {
    let countdownTimer: NodeJS.Timeout
    
    if (activeNotification && notificationTimeLeft > 0) {
      countdownTimer = setInterval(() => {
        setNotificationTimeLeft(prev => {
          if (prev <= 1) {
            // Auto-decline when timer reaches 0
            console.log('⏰ Notification timed out, auto-declining ride')
            setActiveNotification(null)
            setRideRequests(prev => prev.filter(req => req.id !== activeNotification.id))
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    
    return () => {
      if (countdownTimer) clearInterval(countdownTimer)
    }
  }, [activeNotification, notificationTimeLeft])

  // Play notification sound for new ride requests
  const playNotificationSound = () => {
    try {
      // Create a simple notification tone using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      
      // Create a beep sound
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime) // 800Hz tone
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.5)
      
      console.log('🔔 New ride request notification sound played')
    } catch (error) {
      console.error('Failed to play notification sound:', error)
    }
  }

  // Get map markers for ride requests
  const getMapMarkers = () => {
    const markers: any[] = []
    
    // Add driver location marker
    if (driverLocation) {
      markers.push({
        position: [driverLocation.latitude, driverLocation.longitude],
        popupText: 'Your Location (Driver)',
        icon: 'driver'
      })
    }
    
    // Add ride request markers
    rideRequests.forEach((request, index) => {
      markers.push({
        position: [request.pickupCoordinates.latitude, request.pickupCoordinates.longitude],
        popupText: `Pickup: ${request.pickupAddress}\nPassenger: ${request.passengerName}`,
        icon: 'pickup'
      })
    })
    
    return markers
  }

  const handleAcceptRide = async (rideRequest: RideRequest) => {
    if (isProcessingRide) return
    
    setIsProcessingRide(true)
    try {
      console.log('🚗 Accepting ride:', rideRequest.rideId)
      
      const response = await fetch(`/api/rides/${rideRequest.rideId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: user?.id,
          driverLocation: driverLocation ? {
            latitude: driverLocation.latitude,
            longitude: driverLocation.longitude
          } : null
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        console.log('✅ Ride accepted successfully:', result.data)
        
        // Set the accepted ride with full details including OTP
        const acceptedRideData = {
          ...result.data,
          pickupAddress: rideRequest.pickupAddress,
          destinationAddress: rideRequest.destinationAddress,
          passengerName: rideRequest.passengerName,
          pickupCoordinates: rideRequest.pickupCoordinates,
          estimatedArrival: rideRequest.estimatedTimeToPickup || 'Calculating...'
        }
        
        console.log('✅ Setting accepted ride data:', acceptedRideData)
        setAcceptedRide(acceptedRideData)
        
        // Clear all ride requests as driver is now busy
        setRideRequests([])
        setActiveNotification(null) // Clear active notification
        setNotificationTimeLeft(0)
        console.log('✅ Ride accepted successfully. OTP:', result.data.otp)
      } else {
        alert(result.error?.message || 'Failed to accept ride')
      }
    } catch (error) {
      console.error('Failed to accept ride:', error)
      alert('Network error while accepting ride')
    } finally {
      setIsProcessingRide(false)
    }
  }

  const handleDeclineRide = async (rideId: string) => {
    if (isProcessingRide) return
    
    setIsProcessingRide(true)
    try {
      // For now, just remove from local state (no server call needed for decline)
      setRideRequests(prev => prev.filter(req => req.rideId !== rideId))
      setActiveNotification(null) // Clear active notification
      setNotificationTimeLeft(0)
      console.log('✅ Ride declined:', rideId)
    } catch (error) {
      console.error('Failed to decline ride:', error)
    } finally {
      setIsProcessingRide(false)
    }
  }

  const handleAcceptNotification = () => {
    if (activeNotification) {
      handleAcceptRide(activeNotification)
    }
  }

  const handleDeclineNotification = () => {
    if (activeNotification) {
      handleDeclineRide(activeNotification.rideId)
    }
  }

  const handleNavigateToPickup = () => {
    if (acceptedRide && acceptedRide.pickupCoordinates) {
      const { latitude, longitude } = acceptedRide.pickupCoordinates
      // Open Google Maps with navigation to pickup location
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`
      window.open(mapsUrl, '_blank')
      console.log('🧭 Opening navigation to pickup location')
    }
  }

  const handleStartRide = async () => {
    if (!acceptedRide) return
    
    try {
      const response = await fetch(`/api/rides/${acceptedRide.rideId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'in_progress',
          driverId: user?.id
        })
      })

      if (response.ok) {
        setAcceptedRide((prev: any) => prev ? { ...prev, status: 'in_progress' } : null)
        console.log('▶️ Ride started successfully')
      } else {
        alert('Failed to start ride')
      }
    } catch (error) {
      console.error('Failed to start ride:', error)
      alert('Network error while starting ride')
    }
  }

  const handleCompleteRide = async () => {
    if (!acceptedRide) return
    
    try {
      const response = await fetch(`/api/rides/${acceptedRide.rideId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          driverId: user?.id
        })
      })

      if (response.ok) {
        setAcceptedRide(null)
        console.log('✅ Ride completed successfully')
        alert('Ride completed! Thank you for using GoCabs eco-friendly service.')
      } else {
        alert('Failed to complete ride')
      }
    } catch (error) {
      console.error('Failed to complete ride:', error)
      alert('Network error while completing ride')
    }
  }

  // Show loading if still checking auth
  if (isLoading || status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Loading Driver Dashboard...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white">
      {/* Mobile-First Header */}
      <header className="bg-white shadow-lg border-b border-green-100 sticky top-0 z-40">
        <div className="px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">G</span>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                  GoCabs Driver
                </h1>
                <p className="text-xs text-gray-500">Hi, {user?.firstName}!</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button 
                onClick={signOut}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* Status Indicators - Mobile Optimized */}
          <div className="flex items-center justify-between mt-3 space-x-2">
            <div className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-sm font-medium ${
              driverLocation ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-gray-100 text-gray-800 border border-gray-200'
            }`}>
              <span className={`w-3 h-3 rounded-full ${
                isUpdatingLocation ? 'bg-yellow-400 animate-pulse' : 
                driverLocation ? 'bg-green-500' : 'bg-gray-400'
              }`}></span>
              <span className="text-xs">
                {isUpdatingLocation ? 'Updating...' : 
                 driverLocation ? 'Online' : 'Getting location...'}
              </span>
            </div>
            
            <div className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-sm font-medium ${
              isConnected ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'
            }`}>
              <span className={`w-3 h-3 rounded-full ${
                isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              }`}></span>
              <span className="text-xs">
                {isConnected ? 'Real-time' : 'Connecting...'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Location Error */}
      {locationError && (
        <div className="bg-red-50 border-b border-red-200 text-red-700 px-4 py-3">
          <p className="text-sm text-center">{locationError}</p>
        </div>
      )}

      {/* Persistent Ride Notification Overlay */}
      {activeNotification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 animate-pulse-slow">
            {/* Notification Header */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white p-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                    <span className="text-lg">🚗</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">New Ride Request!</h3>
                    <p className="text-sm opacity-90">Tap to accept or decline</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">🌱 Eco Ride</div>
                  <div className="text-sm opacity-90">{activeNotification.distanceToPickup.toFixed(1)} km away</div>
                </div>
              </div>
            </div>

            {/* Countdown Timer */}
            <div className="bg-orange-100 px-4 py-2">
              <div className="flex items-center justify-center space-x-2">
                <span className="text-orange-600 font-semibold">⏰ Time remaining:</span>
                <span className="text-2xl font-bold text-orange-700">{notificationTimeLeft}s</span>
              </div>
              <div className="w-full bg-orange-200 rounded-full h-2 mt-2">
                <div 
                  className="bg-orange-500 h-2 rounded-full transition-all duration-1000"
                  style={{ width: `${(notificationTimeLeft / 120) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Ride Details */}
            <div className="p-4 space-y-4">
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-4 h-4 bg-green-500 rounded-full mt-1 flex-shrink-0"></div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">PICKUP</p>
                    <p className="text-sm font-medium text-gray-900">{activeNotification.pickupAddress}</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-4 h-4 bg-red-500 rounded-full mt-1 flex-shrink-0"></div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">DESTINATION</p>
                    <p className="text-sm font-medium text-gray-900">{activeNotification.destinationAddress}</p>
                  </div>
                </div>
              </div>

              {activeNotification.estimatedTimeToPickup && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-blue-900">
                    🕐 Estimated pickup time: {activeNotification.estimatedTimeToPickup}
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="p-4 pt-0 space-y-3">
              <button
                onClick={handleAcceptNotification}
                disabled={isProcessingRide}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 px-6 rounded-xl hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg transition-all duration-200 shadow-lg"
              >
                {isProcessingRide ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                    Accepting...
                  </div>
                ) : (
                  '✅ Accept Ride'
                )}
              </button>
              
              <button
                onClick={handleDeclineNotification}
                disabled={isProcessingRide}
                className="w-full bg-gradient-to-r from-gray-500 to-gray-600 text-white py-3 px-6 rounded-xl hover:from-gray-600 hover:to-gray-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all duration-200"
              >
                ❌ Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Mobile First Layout */}
      <div className="flex-1 px-4 py-4 space-y-4">
        {/* Driver Status Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-green-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Driver Status</h2>
            <div className={`px-4 py-2 rounded-full text-sm font-bold ${
              driverLocation 
                ? 'bg-green-100 text-green-800 border-2 border-green-200' 
                : 'bg-red-100 text-red-800 border-2 border-red-200'
            }`}>
              {driverLocation ? '🟢 Active' : '🔴 Inactive'}
            </div>
          </div>
          
          {driverLocation && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-green-800">📍 Location Active</p>
                  <p className="text-xs text-green-600 mt-1">
                    Last updated: {driverLocation.lastUpdate.toLocaleTimeString()}
                  </p>
                </div>
                {isUpdatingLocation && (
                  <div className="flex items-center text-green-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-green-200 border-t-green-600 mr-2"></div>
                    <span className="text-xs font-medium">Updating...</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Map Section - Mobile Optimized */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-green-100">
          <div className="p-4 bg-gradient-to-r from-green-600 to-emerald-600">
            <h2 className="text-lg font-bold text-white flex items-center">
              <span className="mr-2">🗺️</span>
              Live Location
            </h2>
          </div>
          <div className="h-64 sm:h-80">
            {driverLocation ? (
              <MapView 
                center={[driverLocation.latitude, driverLocation.longitude]} 
                zoom={15}
                markers={getMapMarkers()}
              />
            ) : (
              <div className="h-full flex items-center justify-center bg-gradient-to-br from-green-50 to-white">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-green-200 border-t-green-600 mx-auto mb-4"></div>
                  <p className="text-gray-700 font-medium">Getting your location...</p>
                  <p className="text-gray-500 text-sm mt-1">Please enable location services</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Ride Management Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-green-100">
          <div className="p-4 bg-gradient-to-r from-green-600 to-emerald-600">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center">
                <span className="mr-2">🚗</span>
                {acceptedRide ? 'Current Ride' : 'Available Rides'}
              </h2>
              {!acceptedRide && rideRequests.length > 0 && (
                <span className="bg-white/20 text-white px-3 py-1 rounded-full text-sm font-bold">
                  {rideRequests.length} new
                </span>
              )}
            </div>
          </div>
          
          <div className="p-4">
            {acceptedRide ? (
              /* Accepted Ride Section - Mobile Optimized */
              <div className="space-y-4">
                {/* OTP Display - Prominent */}
                <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-6 text-white text-center shadow-lg">
                  <div className="text-sm font-medium opacity-90 mb-2">Ride OTP</div>
                  <div className="text-4xl font-bold tracking-widest mb-2">{acceptedRide.otp}</div>
                  <div className="text-sm opacity-90">Share with passenger for verification</div>
                </div>

                {/* Passenger Info */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-2xl">👤</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{acceptedRide.passengerName}</p>
                      <p className="text-sm text-gray-600">Passenger</p>
                    </div>
                  </div>
                </div>

                {/* Route Information */}
                <div className="space-y-3">
                  <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-xl border border-green-200">
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-xs font-bold">P</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">PICKUP LOCATION</p>
                      <p className="text-sm font-medium text-gray-900 mt-1">{acceptedRide.pickupAddress}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3 p-3 bg-red-50 rounded-xl border border-red-200">
                    <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-xs font-bold">D</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">DESTINATION</p>
                      <p className="text-sm font-medium text-gray-900 mt-1">{acceptedRide.destinationAddress}</p>
                    </div>
                  </div>
                </div>

                {/* Estimated Arrival */}
                {acceptedRide.estimatedArrival && (
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
                    <div className="flex items-center space-x-2">
                      <span className="text-purple-600">⏱️</span>
                      <div>
                        <p className="text-sm font-semibold text-purple-900">Estimated Arrival</p>
                        <p className="text-lg font-bold text-purple-700">{acceptedRide.estimatedArrival}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons - Mobile Optimized */}
                <div className="space-y-3 pt-4">
                  <button
                    onClick={() => handleNavigateToPickup()}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 px-6 rounded-xl font-bold text-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-200 shadow-lg flex items-center justify-center space-x-2"
                  >
                    <span>🧭</span>
                    <span>Navigate to Pickup</span>
                  </button>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleStartRide()}
                      className="bg-white border-2 border-green-600 text-green-600 py-3 px-4 rounded-xl font-semibold hover:bg-green-50 transition-all duration-200 shadow-lg flex items-center justify-center space-x-1"
                    >
                      <span>▶️</span>
                      <span>Start Ride</span>
                    </button>
                    
                    <button
                      onClick={() => handleCompleteRide()}
                      className="bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 px-4 rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all duration-200 shadow-lg flex items-center justify-center space-x-1"
                    >
                      <span>✅</span>
                      <span>Complete</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Ride Requests Section */
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Ride Requests
                  </h3>
                  {rideRequests.length > 0 && (
                    <span className="bg-red-100 text-red-800 text-xs font-medium px-2 py-1 rounded-full">
                      {rideRequests.length} active
                    </span>
                  )}
                </div>

                {rideRequests.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-gray-500">
                      <div className="text-4xl mb-3">🚗</div>
                      <p className="font-medium">No ride requests</p>
                      <p className="text-sm mt-1">Waiting for passengers within 5km...</p>
                      {driverLocation && (
                        <p className="text-xs text-gray-400 mt-2">
                          Location updated {driverLocation.lastUpdate.toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {rideRequests.map((request) => (
                      <div key={request.id} className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-semibold text-gray-900 flex items-center">
                              New Request
                            </h4>
                            <p className="text-sm text-gray-600">from {request.passengerName}</p>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-green-700">🌱 Eco Ride</div>
                            <div className="text-xs text-green-600">{request.distanceToPickup.toFixed(1)} km away</div>
                          </div>
                        </div>

                        <div className="space-y-2 mb-4">
                          <div className="flex items-start space-x-2">
                            <span className="text-green-600 mt-0.5">📍</span>
                            <div>
                              <div className="text-sm font-medium text-gray-900">Pickup</div>
                              <div className="text-sm text-gray-700">{request.pickupAddress}</div>
                            </div>
                          </div>
                          <div className="flex items-start space-x-2">
                            <span className="text-red-500 mt-0.5">📍</span>
                            <div>
                              <div className="text-sm font-medium text-gray-900">Destination</div>
                              <div className="text-sm text-gray-700">{request.destinationAddress}</div>
                            </div>
                          </div>
                        </div>

                        {/* Show OTP */}
                        <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-3">
                          <div className="text-xs text-blue-700 font-medium">Ride OTP</div>
                          <div className="text-lg font-bold text-blue-900 tracking-widest">{request.otp}</div>
                        </div>

                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleAcceptRide(request)}
                            disabled={isProcessingRide}
                            className="flex-1 bg-green-600 text-white py-2 px-3 rounded-lg font-medium hover:bg-green-700 transition-colors text-sm disabled:bg-gray-400"
                          >
                            {isProcessingRide ? '...' : 'Accept'}
                          </button>
                          <button
                            onClick={() => handleDeclineRide(request.rideId)}
                            disabled={isProcessingRide}
                            className="flex-1 bg-gray-500 text-white py-2 px-3 rounded-lg font-medium hover:bg-gray-600 transition-colors text-sm disabled:bg-gray-400"
                          >
                            {isProcessingRide ? '...' : 'Decline'}
                          </button>
                        </div>

                        <div className="mt-3 text-xs text-gray-500 text-center">
                          {new Date(request.requestedAt).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
