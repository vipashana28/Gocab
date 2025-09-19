'use client'

import { useEffect, useState } from 'react'
import { useGoCabAuth } from '@/lib/auth/use-gocab-auth-google'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { usePusher } from '@/lib/hooks/use-pusher'
import { useGPSTracking } from '@/lib/hooks/use-gps-tracking'
import MapView from '@/components/Map/MapView'
import PhoneCollectionModal, { DriverDetails } from '@/components/PhoneCollectionModal'
import RouteDisplayModal from '@/components/RouteDisplayModal'

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
  destinationCoordinates: { latitude: number, longitude: number }
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
  const {
    position: gpsPosition,
    error: gpsError,
    isTracking: isGPSTracking,
    accuracy: gpsAccuracy,
    startTracking: startGPSTracking,
    stopTracking: stopGPSTracking,
    requestPermission: requestGPSPermission,
    isSupported: isGPSSupported
  } = useGPSTracking({
    enableHighAccuracy: true,
    updateInterval: 3000, // Update every 3 seconds for real-time tracking
    timeout: 10000
  })
  
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null)
  const [rideRequests, setRideRequests] = useState<RideRequest[]>([])
  const [acceptedRide, setAcceptedRide] = useState<any>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false)
  const [previousRequestCount, setPreviousRequestCount] = useState(0)
  const [isProcessingRide, setIsProcessingRide] = useState(false)
  const [activeNotification, setActiveNotification] = useState<RideRequest | null>(null)
  const [notificationTimeLeft, setNotificationTimeLeft] = useState(0)
  const [showPhoneModal, setShowPhoneModal] = useState(false)
  const [isUpdatingPhone, setIsUpdatingPhone] = useState(false)
  const [showRouteModal, setShowRouteModal] = useState(false)

  // Let middleware handle authentication redirects

  // Check if phone number is required
  useEffect(() => {
    if (isAuthenticated && user && !user.phone) {
      setShowPhoneModal(true)
    }
  }, [isAuthenticated, user])

  // Initialize GPS tracking when authenticated
  useEffect(() => {
    if (isAuthenticated && user?.phone && isGPSSupported) {
      requestGPSPermission().then((granted) => {
        if (granted) {
          startGPSTracking()
        } else {
          setLocationError('GPS permission required for driver features')
        }
      })
    }

    return () => {
      if (isGPSTracking) {
        stopGPSTracking()
      }
    }
  }, [isAuthenticated, user?.phone, isGPSSupported])

  // Update driver location when GPS position changes
  useEffect(() => {
    if (gpsPosition && isAuthenticated && user?.id) {
      const newLocation: DriverLocation = {
        latitude: gpsPosition.latitude,
        longitude: gpsPosition.longitude,
        lastUpdate: new Date(gpsPosition.timestamp)
      }

      setDriverLocation(newLocation)
      setLocationError(null)

      // Update location on server
      updateDriverLocationOnServer(newLocation)
    }
  }, [gpsPosition, isAuthenticated, user?.id])

  // Handle GPS errors
  useEffect(() => {
    if (gpsError) {
      setLocationError(gpsError)
    }
  }, [gpsError])

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
              
              setDriverLocation(newLocation)
              
              try {
                await fetch('/api/drivers/location', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    driverId: user.id,
                    location: { latitude: newLocation.latitude, longitude: newLocation.longitude }
                  })
                })

                if (acceptedRide) {
                  await fetch(`/api/rides/${acceptedRide.rideId}/location`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      driverId: user.id,
                      location: { latitude: newLocation.latitude, longitude: newLocation.longitude }
                    })
                  })
                }
                
                setLocationError(null)
              } catch (error) {
                setLocationError('Failed to update location')
              } finally {
                setIsUpdatingLocation(false)
              }
            },
            () => {
              setLocationError('Unable to access location. Please enable location services.')
              setIsUpdatingLocation(false)
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
          )
        }
      }

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
      joinAsDriver(user.id)
      
      const unsubscribeNewRides = onNewRide((rideData: any) => {
        const newRequest: RideRequest = {
          id: rideData.id,
          rideId: rideData.rideId,
          otp: rideData.otp,
          pickupAddress: rideData.pickup?.address || 'Unknown pickup',
          destinationAddress: rideData.destination?.address || 'Unknown destination',
          pickupCoordinates: rideData.pickup?.coordinates || { latitude: 0, longitude: 0 },
          destinationCoordinates: rideData.destination?.coordinates || { latitude: 0, longitude: 0 },
          estimatedFare: rideData.pricing?.totalEstimated || 0,
          distanceToPickup: rideData.distanceToPickup || 0,
          passengerName: 'Passenger',
          requestedAt: new Date(rideData.requestedAt),
          estimatedTimeToPickup: rideData.estimatedTimeToPickup
        }
        
        setRideRequests(prev => {
          const exists = prev.some(req => req.id === newRequest.id)
          if (!exists) return [...prev, newRequest]
          return prev
        })
        
        if (!activeNotification) {
          setActiveNotification(newRequest)
          setNotificationTimeLeft(120) // 2 minutes to respond
        }
      })
      
      const unsubscribeSound = onNotificationSound(() => {
        playNotificationSound()
      })
      
      return () => {
        unsubscribeNewRides()
        unsubscribeSound()
      }
    }
  }, [isAuthenticated, user?.id, isConnected, joinAsDriver, onNewRide, onNotificationSound, activeNotification])

  // Fallback polling when WebSocket is not connected (reduced frequency)
  useEffect(() => {
    let requestInterval: NodeJS.Timeout

    if (driverLocation && user?.id && !isConnected) {
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

      fetchAvailableRides()
      requestInterval = setInterval(fetchAvailableRides, 3000)
    } else if (isConnected) {
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
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.5)
    } catch (error) {
      console.error('Failed to play notification sound:', error)
    }
  }

  // Get map markers for ride requests
  const getMapMarkers = () => {
    const markers: any[] = []
    
    if (driverLocation) {
      markers.push({
        position: [driverLocation.latitude, driverLocation.longitude],
        popupText: 'Your Location (Driver)',
        icon: 'driver'
      })
    }
    
    rideRequests.forEach((request) => {
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
          driverLocation: driverLocation ? {
            latitude: driverLocation.latitude,
            longitude: driverLocation.longitude
          } : null
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        const acceptedRideData = {
          ...result.data,
          pickupAddress: rideRequest.pickupAddress,
          destinationAddress: rideRequest.destinationAddress,
          passengerName: rideRequest.passengerName,
          pickupCoordinates: rideRequest.pickupCoordinates,
          destinationCoordinates: rideRequest.destinationCoordinates,
          estimatedArrival: rideRequest.estimatedTimeToPickup || 'Calculating...'
        }
        setAcceptedRide(acceptedRideData)
        setRideRequests([])
        setActiveNotification(null)
        setNotificationTimeLeft(0)
      } else {
        alert(result.error?.message || 'Failed to accept ride')
      }
    } catch (error) {
      alert('Network error while accepting ride')
    } finally {
      setIsProcessingRide(false)
    }
  }

  const handleDeclineRide = async (rideId: string) => {
    if (isProcessingRide) return
    
    setIsProcessingRide(true)
    try {
      setRideRequests(prev => prev.filter(req => req.rideId !== rideId))
      setActiveNotification(null)
      setNotificationTimeLeft(0)
    } catch (error) {
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
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`
      window.open(mapsUrl, '_blank')
    } else {
      alert('No pickup location available')
    }
  }

  const handleStartRide = async () => {
    if (!acceptedRide) { alert('No active ride to start'); return }
    try {
      const response = await fetch(`/api/rides/${acceptedRide.rideId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'in_progress',
          driverId: user?.id
        })
      })

      const responseData = await response.json()

      if (response.ok) {
        setAcceptedRide((prev: any) => prev ? { ...prev, status: 'in_progress' } : null)
        alert('Ride started! En route to destination.')
      } else {
        alert(`Failed to start ride: ${responseData.error?.message || 'Unknown error'}`)
      }
    } catch (error) {
      alert('Network error while starting ride. Please check your connection.')
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
        showRideCompletionCelebration()
        setTimeout(() => {
          setAcceptedRide(null)
        }, 3000)
      } else {
        alert('Failed to complete ride')
      }
    } catch (error) {
      alert('Network error while completing ride')
    }
  }

  const showRideCompletionCelebration = () => {
    // Minimal, icon-only (no emojis), monochrome
    const modal = document.createElement('div')
    modal.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-50'
    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 text-center animate-scale-in">
        <div class="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-neutral-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>
        <h2 class="text-2xl font-bold text-neutral-900 mb-2">Ride Completed</h2>
        <p class="text-neutral-600 mb-4">Thanks for driving with GoCabs.</p>
        <div class="bg-neutral-50 border border-neutral-200 rounded-xl p-4 mb-4">
          <p class="text-neutral-900 text-sm font-medium">Impact</p>
          <p class="text-neutral-700 text-xs mt-1">Every ride contributes to reduced emissions.</p>
        </div>
        <div class="flex gap-3">
          <button onclick="window.__shareOnX?.()" class="flex-1 bg-neutral-900 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-black transition-colors">
            Share on X
          </button>
          <button onclick="this.closest('.fixed').remove()" class="flex-1 bg-neutral-100 text-neutral-800 py-2 px-4 rounded-lg text-sm font-medium hover:bg-neutral-200 transition-colors">
            Close
          </button>
        </div>
      </div>
    `
    ;(window as any).__shareOnX = () => {
      const text = encodeURIComponent('Just completed another ride with GoCabs.')
      const url = `https://x.com/intent/post?text=${text}`
      window.open(url, '_blank')
      modal.remove()
    }
    document.body.appendChild(modal)
    setTimeout(() => { if (document.body.contains(modal)) modal.remove() }, 10000)
  }

  const handlePhoneSubmit = async (driverDetails: DriverDetails) => {
    if (!user?.id) return
    
    setIsUpdatingPhone(true)
    
    try {
      const response = await fetch('/api/users/phone', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          phone: driverDetails.phoneNumber,
          vehicleName: driverDetails.vehicleName,
          licensePlate: driverDetails.licensePlate,
          vehicleType: driverDetails.vehicleType
        })
      })

      const responseData = await response.json()

      if (response.ok) {
        setShowPhoneModal(false)
        window.location.reload()
      } else {
        alert(`Failed to update phone number: ${responseData.error?.message || 'Unknown error'}`)
      }
    } catch (error) {
      alert('Network error while updating phone number. Please try again.')
    } finally {
      setIsUpdatingPhone(false)
    }
  }

  const updateDriverLocationOnServer = async (location: DriverLocation) => {
    if (!user?.id) return

    try {
      const response = await fetch('/api/drivers/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: user.id,
          latitude: location.latitude,
          longitude: location.longitude
        })
      })

      if (!response.ok) {
        console.error('Failed to update location on server')
      }
    } catch (error) {
      console.error('Network error updating location:', error)
    }
  }

  // Show loading if still checking auth
  if (isLoading || status === 'loading') {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading Driver Dashboard...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Header — sleek, monochrome, no gradients */}
      <header className="bg-white/90 backdrop-blur border-b border-neutral-200 sticky top-0 z-40">
        <div className="px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-sm ring-1 ring-neutral-200">
                <img src="/icons/GOLOGO.svg" alt="GoCabs Logo" className="w-full h-full" />
              </div>
              <div className="leading-tight">
                <h1 className="text-base font-semibold tracking-tight">GoCabs • Driver</h1>
                <p className="text-xs text-neutral-500">{user?.firstName || 'Driver'}</p>
              </div>
            </div>
            
            <button 
              onClick={signOut}
              className="inline-flex items-center justify-center p-2 rounded-md text-neutral-600 hover:bg-neutral-100 transition-colors"
              aria-label="Sign out"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Location Error */}
      {locationError && (
        <div className="bg-neutral-100 border-b border-neutral-200 text-neutral-800 px-4 py-3">
          <p className="text-sm text-center">{locationError}</p>
        </div>
      )}

      {/* Persistent Ride Notification — monochrome, sexy bottom sheet with micro-interactions */}
      {activeNotification && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
          <div className="relative w-full sm:max-w-md bg-white border border-neutral-200 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-neutral-100 flex items-center justify-center ring-1 ring-neutral-200">
                  {/* Car icon */}
                  <svg className="w-4.5 h-4.5 text-neutral-900" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5 11h3l3-7h4a4 4 0 014 4v7h-2a3 3 0 11-6 0H9a3 3 0 11-6 0H1v-2a2 2 0 012-2h2Z"/>
                  </svg>
                </div>
                <div className="leading-tight">
                  <h3 className="text-sm font-semibold">New ride request</h3>
                  <p className="text-[11px] text-neutral-500">Respond within the timer</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-neutral-500">Distance</div>
                <div className="text-sm font-semibold tabular-nums">{activeNotification.distanceToPickup.toFixed(1)} km</div>
              </div>
            </div>

            {/* Countdown */}
            <div className="px-4 py-2 bg-neutral-50 border-b border-neutral-200">
              <div className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 text-neutral-900" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span className="text-sm font-medium">Time remaining</span>
                <span className="text-lg font-bold tabular-nums">{notificationTimeLeft}s</span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-2 mt-2 overflow-hidden">
                <div 
                  className="bg-neutral-900 h-2 transition-all duration-1000"
                  style={{ width: `${(notificationTimeLeft / 120) * 100}%` }}
                />
              </div>
            </div>

            {/* Details */}
            <div className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-4 h-4 rounded-full bg-neutral-900 mt-1" />
                <div className="flex-1">
                  <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Pickup</p>
                  <p className="text-sm font-medium">{activeNotification.pickupAddress}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-4 h-4 rounded-full bg-neutral-400 mt-1" />
                <div className="flex-1">
                  <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Destination</p>
                  <p className="text-sm font-medium">{activeNotification.destinationAddress}</p>
                </div>
              </div>

              {activeNotification.estimatedTimeToPickup && (
                <div className="bg-white border border-neutral-200 rounded-lg p-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-neutral-900" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3M9 2h6M12 6a9 9 0 100 18 9 9 0 000-18z"/>
                  </svg>
                  <span className="text-sm">Est. pickup:</span>
                  <span className="text-sm font-semibold">{activeNotification.estimatedTimeToPickup}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-4 pb-4 flex gap-3">
              <button
                onClick={handleAcceptNotification}
                disabled={isProcessingRide}
                className="group flex-1 inline-flex items-center justify-center bg-neutral-900 text-white py-3 rounded-xl font-semibold hover:bg-black transition disabled:opacity-50"
              >
                <span className="relative inline-flex items-center gap-2">
                  <svg className="w-4 h-4 translate-y-[0.5px]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 12l2 2 4-4 2 2-6 6-4-4z"/>
                  </svg>
                  {isProcessingRide ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                      Accepting…
                    </span>
                  ) : (
                    'Accept Ride'
                  )}
                </span>
              </button>
              <button
                onClick={handleDeclineNotification}
                disabled={isProcessingRide}
                className="flex-1 inline-flex items-center justify-center bg-white border border-neutral-300 text-neutral-900 py-3 rounded-xl font-semibold hover:bg-neutral-50 transition disabled:opacity-50"
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M18 6L6 18M6 6l12 12"/></svg>
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Map Section */}
      <div className="h-96 relative">
        {driverLocation ? (
          <MapView 
            center={[driverLocation.latitude, driverLocation.longitude]} 
            zoom={15}
            markers={getMapMarkers()}
          />
        ) : (
          <div className="h-full flex items-center justify-center bg-neutral-100">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-neutral-200 border-t-neutral-900 mx-auto mb-4"></div>
              <p className="text-neutral-600">Getting your location…</p>
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="bg-white border-b border-neutral-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 text-sm ${isGPSTracking && driverLocation ? 'text-neutral-900' : 'text-neutral-500'}`}>
              <span className={`w-2 h-2 rounded-full ${isGPSTracking && driverLocation ? 'bg-neutral-900' : 'bg-neutral-400'}`} />
              <span>
                {isGPSTracking && driverLocation ? `GPS ${gpsAccuracy ? `±${Math.round(gpsAccuracy)}m` : ''}` : 'No GPS'}
              </span>
            </div>
            <div className={`flex items-center gap-2 text-sm ${isConnected ? 'text-neutral-900' : 'text-red-600'}`}>
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-neutral-900' : 'bg-red-600'}`} />
              <span>{isConnected ? 'Connected' : 'Offline'}</span>
            </div>
          </div>

          <button
            onClick={() => {
              if (!driverLocation || !isGPSTracking) {
                alert('Please enable GPS location to go online')
                return
              }
              // toggle online status hook here if needed
            }}
            className={`px-5 py-2 rounded-full text-sm font-medium transition
              ${driverLocation && isGPSTracking
                ? 'bg-neutral-900 text-white hover:bg-black'
                : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'}`}
          >
            {driverLocation && isGPSTracking ? 'You’re Online' : 'Go Online'}
          </button>
        </div>
      </div>

      {/* Content Area (compact, no bulky cards) */}
      <div className="p-4">
        {acceptedRide ? (
          <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-neutral-900" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 8h5a4 4 0 014 4v6M3 8a2 2 0 104 0 2 2 0 00-4 0zm10 10h8M21 18a2 2 0 10-4 0 2 2 0 004 0z"/>
                </svg>
                <h2 className="text-sm font-semibold">Current ride</h2>
              </div>
              <span className="text-[11px] px-2 py-1 rounded-full bg-neutral-100 text-neutral-800">Active</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Passenger</p>
                <p className="text-sm font-medium">{acceptedRide.passengerName}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Pickup</p>
                <p className="text-sm">{acceptedRide.pickupAddress}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Destination</p>
                <p className="text-sm">{acceptedRide.destinationAddress}</p>
              </div>
            </div>

            {acceptedRide.otp && (
              <div className="mt-4 bg-neutral-50 border border-neutral-200 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-neutral-900" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 11c.667 0 2-.4 2-2a2 2 0 10-4 0c0 1.6 1.333 2 2 2zm0 0v4m-6 7a2 2 0 01-2-2v-7a2 2 0 011-1.732l7-4a2 2 0 012 0l7 4A2 2 0 0120 13v7a2 2 0 01-2 2H6z"/>
                  </svg>
                  <span className="text-sm font-medium">Pickup code</span>
                </div>
                <span className="text-xl font-bold tracking-widest tabular-nums">{acceptedRide.otp}</span>
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={handleNavigateToPickup}
                className="inline-flex items-center justify-center gap-2 bg-neutral-900 text-white py-3 rounded-lg font-medium hover:bg-black transition"
              >
              
                Navigate
              </button>
              <button
                onClick={handleStartRide}
                className="inline-flex items-center justify-center gap-2 bg-white border border-neutral-300 text-neutral-900 py-3 rounded-lg font-medium hover:bg-neutral-50 transition"
              >
                
                Start
              </button>
              <button
                onClick={handleCompleteRide}
                className="inline-flex items-center justify-center gap-2 bg-neutral-900 text-white py-3 rounded-lg font-medium hover:bg-black transition"
              >
                
                Complete
              </button>
            </div>
          </div>
        ) : driverLocation && isGPSTracking ? (
          <div className="py-10 text-center">
            <div className="w-14 h-14 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <h3 className="text-base font-medium mb-1">Looking for rides…</h3>
            <p className="text-neutral-600 text-sm">You’ll be notified when a request arrives.</p>
          </div>
        ) : (
          <div className="py-10 text-center">
            <div className="w-14 h-14 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a8.949 8.949 0 008.354-5.646z"/>
              </svg>
            </div>
            <h3 className="text-base font-medium mb-1">You’re offline</h3>
            <p className="text-neutral-600 text-sm mb-4">Go online to start receiving ride requests.</p>
            <button
              onClick={() => {
                if (!driverLocation || !isGPSTracking) {
                  alert('Please enable GPS location to go online')
                  return
                }
              }}
              className="bg-neutral-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-black transition"
            >
              Go Online
            </button>
          </div>
        )}
      </div>

      {/* Phone Collection Modal */}
      <PhoneCollectionModal
        isOpen={showPhoneModal}
        onClose={() => {}} // Mandatory - cannot close without providing phone
        onSubmit={handlePhoneSubmit}
        isLoading={isUpdatingPhone}
      />

      {/* Route Display Modal */}
      {acceptedRide && acceptedRide.pickupCoordinates && acceptedRide.destinationCoordinates && (
        <RouteDisplayModal
          isOpen={showRouteModal}
          onClose={() => setShowRouteModal(false)}
          pickup={{
            address: acceptedRide.pickupAddress || 'Pickup Location',
            coordinates: acceptedRide.pickupCoordinates
          }}
          destination={{
            address: acceptedRide.destinationAddress || 'Destination',
            coordinates: acceptedRide.destinationCoordinates
          }}
          currentLocation={driverLocation ? {
            latitude: driverLocation.latitude,
            longitude: driverLocation.longitude
          } : undefined}
        />
      )}

      {/* Scoped micro-animations */}
      <style jsx>{`
        .animate-slide-up {
          animation: slideUp 320ms cubic-bezier(.2,.9,.2,1) both;
        }
        @keyframes slideUp {
          from { transform: translateY(16px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-scale-in {
          animation: scaleIn 200ms ease-out both;
        }
        @keyframes scaleIn {
          from { transform: scale(.98); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
