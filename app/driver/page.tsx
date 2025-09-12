'use client'

import { useEffect, useState } from 'react'
import { useGoCabAuth } from '@/lib/auth/use-gocab-auth-google'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
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
}

export default function DriverDashboard() {
  const { isAuthenticated, user, isLoading, signOut } = useGoCabAuth()
  const { status } = useSession()
  const router = useRouter()
  
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null)
  const [rideRequests, setRideRequests] = useState<RideRequest[]>([])
  const [acceptedRide, setAcceptedRide] = useState<any>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false)
  const [previousRequestCount, setPreviousRequestCount] = useState(0)
  const [isProcessingRide, setIsProcessingRide] = useState(false)

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

  // Fetch ride requests and play notification sound for new requests
  useEffect(() => {
    let requestInterval: NodeJS.Timeout

    if (driverLocation && user?.id) {
      const fetchRideRequests = async () => {
        try {
          const response = await fetch(`/api/drivers/rides?driverId=${user.id}`)
          if (response.ok) {
            const data = await response.json()
            if (data.success) {
              const newRequests = data.data || []
              
              // Play notification sound if there are new ride requests
              if (newRequests.length > previousRequestCount && previousRequestCount > 0) {
                playNotificationSound()
              }
              
              setRideRequests(newRequests)
              setPreviousRequestCount(newRequests.length)
            }
          }
        } catch (error) {
          console.error('Failed to fetch ride requests:', error)
        }
      }

      // Fetch immediately and then every 8 seconds
      fetchRideRequests()
      requestInterval = setInterval(fetchRideRequests, 8000)
    } else {
      setRideRequests([])
      setPreviousRequestCount(0)
    }

    return () => {
      if (requestInterval) clearInterval(requestInterval)
    }
  }, [driverLocation, user?.id, previousRequestCount])

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
      const response = await fetch(`/api/rides/${rideRequest.rideId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: user?.id,
          action: 'accept'
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        // Set the accepted ride with full details including OTP
        setAcceptedRide({
          ...result.data,
          pickupAddress: rideRequest.pickupAddress,
          destinationAddress: rideRequest.destinationAddress,
          passengerName: rideRequest.passengerName,
          pickupCoordinates: rideRequest.pickupCoordinates
        })
        
        // Clear all ride requests as driver is now busy
        setRideRequests([])
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
      const response = await fetch(`/api/rides/${rideId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: user?.id,
          action: 'decline'
        })
      })

      if (response.ok) {
        // Remove declined ride from list
        setRideRequests(prev => prev.filter(req => req.rideId === rideId ? false : true))
        console.log('Ride declined')
      }
    } catch (error) {
      console.error('Failed to decline ride:', error)
    } finally {
      setIsProcessingRide(false)
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="flex justify-between items-center px-4 py-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8">
              <img 
                src="/icons/GOLOGO.svg" 
                alt="GoCab Logo" 
                className="w-full h-full"
              />
            </div>
            <h1 className="text-lg font-bold text-gray-900">GoCab Driver</h1>
          </div>
          <div className="flex items-center space-x-3">
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
              driverLocation ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                isUpdatingLocation ? 'bg-yellow-400 animate-pulse' : 
                driverLocation ? 'bg-green-400' : 'bg-gray-400'
              }`}></span>
              <span>
                {isUpdatingLocation ? 'Updating...' : 
                 driverLocation ? 'Online' : 'Getting location...'}
              </span>
            </div>
            <span className="text-sm text-gray-600">Hi, {user?.firstName}!</span>
            <button 
              onClick={signOut}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Location Error */}
      {locationError && (
        <div className="bg-red-50 border-b border-red-200 text-red-700 px-4 py-3">
          <p className="text-sm text-center">{locationError}</p>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Map View */}
        <div className="flex-1 h-64 md:h-auto">
          {driverLocation ? (
            <MapView 
              center={[driverLocation.latitude, driverLocation.longitude]} 
              zoom={15}
              markers={getMapMarkers()}
            />
          ) : (
            <div className="h-full flex items-center justify-center bg-gray-100">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Getting your location...</p>
              </div>
            </div>
          )}
        </div>

        {/* Ride Management Panel - Mobile: Bottom sheet, Desktop: Sidebar */}
        <div className="w-full md:w-80 bg-white border-t md:border-t-0 md:border-l border-gray-200 overflow-y-auto max-h-96 md:max-h-none">
          <div className="p-4">
            {acceptedRide ? (
              /* Accepted Ride Section */
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Active Ride</h3>
                  <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
                    In Progress
                  </span>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="text-center mb-4">
                    <div className="text-sm text-green-700 font-medium">Ride OTP</div>
                    <div className="text-2xl font-bold text-green-900 tracking-widest mb-2">{acceptedRide.otp}</div>
                    <div className="text-xs text-green-600">Share with passenger for verification</div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="text-sm font-medium text-gray-900 mb-1">Passenger</div>
                      <div className="text-sm text-gray-700">{acceptedRide.passengerName}</div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-start space-x-2">
                        <span className="text-green-600 mt-0.5">📍</span>
                        <div>
                          <div className="text-sm font-medium text-gray-900">Pickup</div>
                          <div className="text-sm text-gray-700">{acceptedRide.pickupAddress}</div>
                        </div>
                      </div>
                      <div className="flex items-start space-x-2">
                        <span className="text-red-500 mt-0.5">📍</span>
                        <div>
                          <div className="text-sm font-medium text-gray-900">Destination</div>
                          <div className="text-sm text-gray-700">{acceptedRide.destinationAddress}</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded p-3">
                      <div className="text-sm font-medium text-blue-900">Estimated Arrival</div>
                      <div className="text-lg font-bold text-blue-700">{acceptedRide.estimatedArrival}</div>
                    </div>

                    <div className="space-y-2 pt-3 border-t border-green-200">
                      <button
                        onClick={() => {/* Navigate to pickup */}}
                        className="w-full bg-blue-600 text-white py-2 px-3 rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
                      >
                        Navigate to Pickup
                      </button>
                      <button
                        onClick={() => {/* Start ride */}}
                        className="w-full bg-green-600 text-white py-2 px-3 rounded-lg font-medium hover:bg-green-700 transition-colors text-sm"
                      >
                        Start Ride
                      </button>
                      <button
                        onClick={() => {/* Complete ride */}}
                        className="w-full bg-orange-600 text-white py-2 px-3 rounded-lg font-medium hover:bg-orange-700 transition-colors text-sm"
                      >
                        Complete Ride
                      </button>
                    </div>
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
                            <div className="font-bold text-green-700">${request.estimatedFare.toFixed(2)}</div>
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
