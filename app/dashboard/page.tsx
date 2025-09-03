'use client'

import { useEffect, useState, useMemo } from 'react'
import { useGoCabAuth } from '@/lib/auth/use-gocab-auth-google'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import MapView from '@/components/Map/MapView'

interface ActiveRide {
  id: string
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

interface MapMarker {
  position: [number, number]
  popupText: string
  icon: 'pickup' | 'destination' | 'driver'
}

export default function DashboardPage() {
  const { isAuthenticated, user, isLoading, signOut } = useGoCabAuth()
  const { status } = useSession()
  const router = useRouter()
  
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null)
  const [isBookingRide, setIsBookingRide] = useState(false)
  const [showBookingForm, setShowBookingForm] = useState(false)
  const [pickupAddress, setPickupAddress] = useState('')
  const [destinationAddress, setDestinationAddress] = useState('')
  const [userLocation, setUserLocation] = useState<{ latitude: number, longitude: number } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)

  const [fareEstimate, setFareEstimate] = useState<any>(null)
  const [isCalculatingFare, setIsCalculatingFare] = useState(false)
  const [isSearchingForDriver, setIsSearchingForDriver] = useState(false)


  // Memoize map markers to prevent re-renders
  const markers: MapMarker[] = useMemo(() => {
    const allMarkers: MapMarker[] = []
    if (activeRide) {
      // Pickup marker
      allMarkers.push({
        position: [
          activeRide.pickup.coordinates.latitude,
          activeRide.pickup.coordinates.longitude,
        ],
        popupText: 'Pickup Location',
        icon: 'pickup',
      })
      // Destination marker
      allMarkers.push({
        position: [
          activeRide.destination.coordinates.latitude,
          activeRide.destination.coordinates.longitude,
        ],
        popupText: 'Destination',
        icon: 'destination',
      })
      // Driver marker
      if (activeRide.driverLocation) {
        allMarkers.push({
          position: [
            activeRide.driverLocation.coordinates.latitude,
            activeRide.driverLocation.coordinates.longitude,
          ],
          popupText: `Driver: ${activeRide.driverContact?.name}`,
          icon: 'driver',
        })
      }
    }
    return allMarkers
  }, [activeRide])


  // Redirect if not authenticated (with a small delay to avoid race conditions)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isLoading && !isAuthenticated) {
        console.log('🚨 Not authenticated, redirecting to home')
        router.push('/')
      }
    }, 100)
    
    return () => clearTimeout(timer)
  }, [isAuthenticated, isLoading, router])

  // Get user location
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
            // Fallback to a default location (San Francisco)
            setUserLocation({
              latitude: 37.7749,
              longitude: -122.4194
            })
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5 minutes
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

  // Check for active rides and poll for updates (with demo user handling)
  useEffect(() => {
    const checkActiveRides = async () => {
      if (user) {
        const isDemoUser = user.id === '507f1f77bcf86cd799439011'
        
        if (isDemoUser) {
          // For demo users, check localStorage first and don't override with API
          if (!activeRide) {
            try {
              const savedRide = localStorage.getItem('demo-active-ride')
              if (savedRide) {
                const rideData = JSON.parse(savedRide)
                if (rideData.status && rideData.status !== 'completed' && rideData.status !== 'cancelled') {
                  console.log('🔄 Restoring demo ride from localStorage')
                  setActiveRide(rideData)
                } else {
                  localStorage.removeItem('demo-active-ride')
                }
              }
            } catch (error) {
              console.error('Error restoring demo ride:', error)
              localStorage.removeItem('demo-active-ride')
            }
          }
          return // Don't poll API for demo users
        }
        
        // For real users, check API
        try {
          const response = await fetch(`/api/rides?userId=${user.id}&status=active`)
          if (response.ok) {
            const data = await response.json()
            if (data.success && data.data.length > 0) {
              setActiveRide(data.data[0])
            } else {
              setActiveRide(null)
            }
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
        const interval = setInterval(checkActiveRides, 15000) // Reduced polling frequency
        return () => clearInterval(interval)
      }
    }
  }, [isAuthenticated, user, activeRide])

  // Calculate fare estimate in real-time
  const calculateFareEstimate = async (pickup: string, destination: string) => {
    if (!pickup || !destination || !userLocation) return

    setIsCalculatingFare(true)
    try {

      // We need coordinates for the destination. For now, we'll mock it slightly offset
      // from the user's location. In a real app, we'd use a geocoding service.
      const destinationCoords = {
        lat: userLocation.latitude + (Math.random() - 0.5) * 0.1,
        lng: userLocation.longitude + (Math.random() - 0.5) * 0.1,
      }

      const response = await fetch('/api/directions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: { lat: userLocation.latitude, lng: userLocation.longitude },
          end: destinationCoords,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch route details')
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Could not calculate route')
      }

      const { distance, duration } = result.data

      // Use the real distance and duration for fare calculation
      const baseFare = 3.50
      const distanceFee = distance * 2.25
      const timeFee = duration * 0.15 // Assuming $0.15 per minute
      const totalEstimated = baseFare + distanceFee + timeFee

      // Mock surge pricing (peak hours)
      const currentHour = new Date().getHours()
      const isPeakHour =
        (currentHour >= 7 && currentHour <= 9) ||
        (currentHour >= 17 && currentHour <= 19)
      const surgeMultiplier = isPeakHour ? 1.5 : 1.0

      const estimate = {
        distance: distance,
        baseFare,
        distanceFee: Math.round(distanceFee * 100) / 100,
        timeFee: Math.round(timeFee * 100) / 100,
        subtotal: Math.round(totalEstimated * 100) / 100,
        surgeMultiplier,
        totalEstimated: Math.round(totalEstimated * surgeMultiplier * 100) / 100,
        estimatedDuration: duration,
        carbonSaved: Math.round(distance * 0.404 * 0.6 * 100) / 100,
      }

      setFareEstimate(estimate)
    } catch (error) {
      console.error('Error calculating fare:', error)
      setFareEstimate(null) // Clear estimate on error
    } finally {
      setIsCalculatingFare(false)
    }
  }

  // Real-time fare calculation when addresses change
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (pickupAddress && destinationAddress) {
        calculateFareEstimate(pickupAddress, destinationAddress)
      } else {
        setFareEstimate(null)
      }
    }, 500) // Debounce for 500ms

    return () => clearTimeout(debounceTimer)
  }, [pickupAddress, destinationAddress, userLocation])

  // Load ride history
  
  // Real-time driver location tracking for active rides
  useEffect(() => {
    if (activeRide && activeRide.status !== 'completed' && activeRide.status !== 'cancelled') {
      const interval = setInterval(() => {
        const isDemoUser = user?.id === '507f1f77bcf86cd799439011'
        
        if (isDemoUser && activeRide.driverLocation) {
          // Simulate driver movement for demo
          const currentLocation = activeRide.driverLocation.coordinates
          const userLocation = activeRide.pickup.coordinates
          
          // Move driver closer to user over time
          const progress = Math.min(Date.now() - new Date(activeRide.requestedAt).getTime(), 120000) / 120000 // 2 minutes max
          const newLat = currentLocation.latitude + (userLocation.latitude - currentLocation.latitude) * progress * 0.1
          const newLng = currentLocation.longitude + (userLocation.longitude - currentLocation.longitude) * progress * 0.1
          
          const updatedRide = {
            ...activeRide,
            driverLocation: {
              coordinates: { latitude: newLat, longitude: newLng },
              lastUpdated: new Date()
            }
          }
          
          setActiveRide(updatedRide)
          localStorage.setItem('demo-active-ride', JSON.stringify(updatedRide))
        }
      }, 5000) // Update every 5 seconds

      return () => clearInterval(interval)
    }
  }, [activeRide, user])

  const handleBookRide = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user || !userLocation || !pickupAddress || !destinationAddress) {
      alert('Please fill in all fields and ensure location access is enabled')
      return
    }

    setIsBookingRide(true)

    try {
      const pickup = {
        address: pickupAddress,
        coordinates: userLocation
      }

      // Mock destination coordinates (in production, use Google Places API)
      const destination = {
        address: destinationAddress,
        coordinates: {
          latitude: userLocation.latitude + (Math.random() - 0.5) * 0.1,
          longitude: userLocation.longitude + (Math.random() - 0.5) * 0.1
        }
      }

      const isDemoUser = user.id === '507f1f77bcf86cd799439011'

      if (isDemoUser) {
        // Demo user flow with persistent driver details
        console.log('Creating demo ride with persistent driver details...')
        setShowBookingForm(false)
        setPickupAddress('')
        setDestinationAddress('')
        
        // Create comprehensive demo ride
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
        
        const selectedDriver = demoDrivers[Math.floor(Math.random() * demoDrivers.length)]
        
        const demoRide = {
          id: 'demo-ride-' + Date.now(),
          rideId: 'DEMO-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
          pickupCode: Math.floor(100000 + Math.random() * 900000).toString(),
          status: 'matched',
          statusDisplay: 'Driver Found',
          pickup,
          destination,
          driverContact: selectedDriver,
          driverLocation: {
            coordinates: {
              latitude: userLocation.latitude + 0.005,
              longitude: userLocation.longitude + 0.005
            },
            lastUpdated: new Date()
          },
          pricing: {
            totalEstimated: 15.50,
            baseFare: 3.00,
            distanceFee: 1.50,
            timeFee: 0.25,
            currency: 'USD',
            isSponsored: true
          },
          carbonFootprint: {
            estimatedSaved: 2.3,
            comparisonMethod: 'vs private car',
            calculationMethod: 'EPA standard'
          },
          requestedAt: new Date(),
          estimatedArrival: `${Math.floor(Math.random() * 5) + 3} minutes`
        }
        
        // Immediately set active ride and persist to localStorage
        setActiveRide(demoRide as any)
        localStorage.setItem('demo-active-ride', JSON.stringify(demoRide))
        console.log('✅ Demo ride created and persisted:', demoRide.rideId)
        
        // Simulate driver arrival after 30 seconds
        setTimeout(() => {
          const arrivedRide = {
            ...demoRide,
            status: 'arrived' as const,
            statusDisplay: 'Driver Arrived',
            estimatedArrival: 'Driver is here!'
          }
          setActiveRide(arrivedRide as any)
          localStorage.setItem('demo-active-ride', JSON.stringify(arrivedRide))
          console.log('🚗 Demo driver arrived')
        }, 30000)
        
      } else {
        // Real user API flow
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
          
          // a ride request is submitted and the system is finding a driver.
          if (result.success && result.data.status === 'requested') {
            setIsSearchingForDriver(true)
          }

          // Simulate finding a driver after 3 seconds
          setTimeout(() => {
            const matchedRide = {
              ...result.data,
              status: 'matched' as const,
              statusDisplay: 'Driver Found',
              driverContact: {
                name: 'John Smith',
                phone: '+1 (555) 123-4567',
                vehicleInfo: '2022 Toyota Camry - Blue',
                licensePlate: 'ABC-123',
                photo: 'https://i.pravatar.cc/150?u=driver-john',
              },
              driverLocation: {
                coordinates: {
                  latitude: userLocation.latitude + 0.01,
                  longitude: userLocation.longitude + 0.01
                },
                lastUpdated: new Date(),
              },
              estimatedArrival: '5 minutes',
            }
            setActiveRide(matchedRide)
            // Once a driver is found, turn off the searching UI.
            setIsSearchingForDriver(false)
          }, 3000)
        } else {
          const errorData = await response.json()
          alert(errorData.error?.message || 'Failed to book ride')
        }
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
      setActiveRide(null)
      localStorage.removeItem('demo-active-ride')
      console.log('✅ Demo ride cancelled and removed from localStorage')
      return
    }
    
    try {
      const response = await fetch(`/api/rides/${activeRide.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'cancelled'
        }),
      })

      if (response.ok) {
        setActiveRide(null)
        console.log('Ride cancelled')
      }
    } catch (error) {
      console.error('Error cancelling ride:', error)
    }
  }

  const handleStartTrip = async () => {
    if (!activeRide) return
    
    const isDemoUser = user?.id === '507f1f77bcf86cd799439011'
    
    if (isDemoUser) {
      const updatedRide = {
        ...activeRide,
        status: 'in_progress' as const,
        statusDisplay: 'Trip in Progress'
      }
      setActiveRide(updatedRide)
      localStorage.setItem('demo-active-ride', JSON.stringify(updatedRide))
      console.log('✅ Demo trip started')
      return
    }
    
    try {
      const response = await fetch(`/api/rides/${activeRide.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'in_progress'
        }),
      })

      if (response.ok) {
        const result = await response.json()
        setActiveRide(prev => prev ? { ...prev, status: 'in_progress', statusDisplay: 'Trip in Progress' } : null)
        console.log('Trip started')
      }
    } catch (error) {
      console.error('Error starting trip:', error)
    }
  }

  const handleEndTrip = async () => {
    if (!activeRide) return
    
    const isDemoUser = user?.id === '507f1f77bcf86cd799439011'
    
    if (isDemoUser) {
      // Demo trip completion with mock summary
      const mockDuration = Math.floor(Math.random() * 20) + 10 // 10-30 minutes
      const mockDistance = Math.round((Math.random() * 5 + 2) * 10) / 10 // 2-7 miles
      const mockCarbonSaved = Math.round(mockDistance * 0.4 * 10) / 10 // ~0.4kg per mile
      
      alert(`Trip Completed!\n\nDuration: ${mockDuration} minutes\nDistance: ${mockDistance} miles\nCarbon Saved: ${mockCarbonSaved}kg CO₂\n\nThank you for riding with GoCab!`)
      
      setActiveRide(null)
      localStorage.removeItem('demo-active-ride')
      console.log('✅ Demo trip completed and cleared')
      return
    }
    
    try {
      const response = await fetch(`/api/rides/${activeRide.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'completed'
        }),
      })

      if (response.ok) {
        const result = await response.json()
        console.log('Trip completed successfully:', result.data)
        
        // Show completion summary
        if (result.data.tripSummary) {
          alert(`Trip Completed!\n\nDuration: ${result.data.tripSummary.duration} minutes\nDistance: ${result.data.tripSummary.distance?.toFixed(1)} miles\nCarbon Saved: ${result.data.tripSummary.carbonSaved}kg CO₂\n\nThank you for riding with GoCab!`)
        }
        
        setActiveRide(null)
      }
    } catch (error) {
      console.error('Error ending trip:', error)
      // Fallback: still clear the ride locally
      setActiveRide(null)
    }
  }

  const callDriver = () => {
    if (activeRide?.driverContact?.phone) {
      window.location.href = `tel:${activeRide.driverContact.phone}`
    }
  }

  // Show loading if still checking auth or loading user data
  if (isLoading || status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Loading Dashboard...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null // Will redirect via useEffect
  }

  // Default center to user location or San Francisco
  const mapCenter = userLocation || { latitude: 37.7749, longitude: -122.4194 }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-gray-900">
      
      {/* Full Screen Map */}
      <div className="absolute inset-0 z-0">
        <MapView
          center={[mapCenter.latitude, mapCenter.longitude]}
          zoom={13}
          markers={markers}
        />
      </div>

      {/* Top Header */}
      <div className="absolute top-0 left-0 right-0 z-50 bg-white shadow-sm border-b">
        <div className="flex justify-between items-center px-4 py-3">
          <h1 className="text-lg font-bold text-gray-900">GoCab Dashboard</h1>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-600">Hi, {user?.firstName}!</span>
            <button 
              onClick={async () => {
                if (user && confirm('Clear all active rides for your account? (Admin debug feature)')) {
                  try {
                    const response = await fetch(`/api/users/${user.id}/active-rides`, {
                      method: 'DELETE'
                    })
                    if (response.ok) {
                      const result = await response.json()
                      alert(`Cleared ${result.data.cleared} stale rides`)
                      setActiveRide(null)
                    }
                  } catch (error) {
                    console.error('Failed to clear rides:', error)
                  }
                }
              }}
              className="text-xs text-yellow-600 hover:text-yellow-700"
            >
              🧹 Clear Rides
            </button>
            <button 
              onClick={signOut}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>



      {/* Location Error Alert */}
      {locationError && (
        <div className="absolute top-32 left-4 right-4 z-40 bg-red-500 text-white p-3 rounded-lg shadow-lg">
          <p className="text-sm">{locationError}</p>
        </div>
      )}

      {/* Active Ride Status */}
      {activeRide ? (
        <div className="absolute bottom-0 left-0 right-0 z-50">
          
          {/* Pickup Code Banner */}
          <div className="bg-green-500 text-white text-center py-4 px-4">
            <p className="text-sm font-medium">Your Pickup Code</p>
            <p className="text-3xl font-bold tracking-widest">{activeRide.pickupCode}</p>
            <p className="text-sm opacity-90">Share this code with your driver</p>
          </div>

          {/* Driver Info Card */}
          <div className="bg-white rounded-t-3xl shadow-2xl p-6 max-h-80 overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gray-200 rounded-full overflow-hidden">
                  {activeRide.driverContact?.photo ? (
                    <img 
                      src={activeRide.driverContact.photo} 
                      alt="Driver" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-300 flex items-center justify-center">
                      <span className="text-gray-600 text-xl">🚗</span>
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{activeRide.driverContact?.name || 'Driver'}</h3>
                  <p className="text-sm text-gray-600">{activeRide.driverContact?.vehicleInfo}</p>
                  <p className="text-sm font-medium text-gray-800">{activeRide.driverContact?.licensePlate}</p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                activeRide.status === 'requested' ? 'bg-yellow-100 text-yellow-800' :
                activeRide.status === 'matched' ? 'bg-blue-100 text-blue-800' :
                activeRide.status === 'driver_en_route' ? 'bg-purple-100 text-purple-800' :
                activeRide.status === 'arrived' ? 'bg-green-100 text-green-800' :
                'bg-orange-100 text-orange-800'
              }`}>
                {activeRide.statusDisplay}
              </span>
            </div>

            {/* Estimated Arrival */}
            {activeRide.estimatedArrival && (
              <div className="bg-blue-50 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-700">
                  <span className="font-medium">
                    {activeRide.status === 'arrived' ? 'Status:' : 'Arriving in:'}
                  </span> {activeRide.estimatedArrival}
                </p>
                {activeRide.driverLocation && (
                  <div className="text-xs text-blue-600 mt-1">
                    📍 Location updated {new Date(activeRide.driverLocation.lastUpdated).toLocaleTimeString()}
                  </div>
                )}
              </div>
            )}

            {/* Trip Details */}
            <div className="space-y-3 mb-4">
              <div className="flex items-start space-x-3">
                <div className="w-3 h-3 bg-green-500 rounded-full mt-1"></div>
                <div>
                  <p className="text-sm text-gray-600">Pickup</p>
                  <p className="font-medium">{activeRide.pickup.address}</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-3 h-3 bg-red-500 rounded-full mt-1"></div>
                <div>
                  <p className="text-sm text-gray-600">Destination</p>
                  <p className="font-medium">{activeRide.destination.address}</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {/* Start Trip Button - Show when driver has arrived */}
              {activeRide.status === 'arrived' && (
                <button
                  onClick={handleStartTrip}
                  className="w-full bg-green-600 text-white py-4 px-6 rounded-lg font-bold text-lg hover:bg-green-700 transition-colors"
                >
                  🚀 Start Trip
                </button>
              )}
              
              {/* End Trip Button - Show when trip is in progress */}
              {activeRide.status === 'in_progress' && (
                <button
                  onClick={handleEndTrip}
                  className="w-full bg-blue-600 text-white py-4 px-6 rounded-lg font-bold text-lg hover:bg-blue-700 transition-colors"
                >
                  🏁 End Trip
                </button>
              )}
              
              {/* Standard Action Buttons - Show for other statuses */}
              {activeRide.status !== 'in_progress' && (
                <div className="flex space-x-3">
                  <button
                    onClick={callDriver}
                    className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center space-x-2"
                  >
                    <span>📞</span>
                    <span>Call Driver</span>
                  </button>
                  <button
                    onClick={handleCancelRide}
                    className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-red-700"
                  >
                    Cancel Ride
                  </button>
                </div>
              )}
            </div>

            {/* Carbon Savings */}
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600">
                🌱 You'll save <span className="font-medium text-green-600">{activeRide.carbonFootprint.estimatedSaved}kg CO₂</span> with this ride
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Book Ride Button & Form */
        <div className="absolute bottom-6 left-4 right-4 z-50">
          
          {showBookingForm ? (
            /* Booking Form */
            <div className="bg-white rounded-2xl shadow-2xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Book a Ride</h2>
                <button
                  onClick={() => setShowBookingForm(false)}
                  className="text-gray-500 hover:text-gray-700 text-xl"
                >
                  ✕
                </button>
              </div>
              
              <form onSubmit={handleBookRide} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pickup Location
                  </label>
                  <input
                    type="text"
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    placeholder="Enter pickup address"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Destination
                  </label>
                  <input
                    type="text"
                    value={destinationAddress}
                    onChange={(e) => setDestinationAddress(e.target.value)}
                    placeholder="Where to?"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                {/* Fare Estimate Display */}
                {fareEstimate && (
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-lg">Fare Estimate</span>
                      {fareEstimate.surgeMultiplier > 1 && (
                        <span className="text-red-600 text-sm font-medium">
                          {fareEstimate.surgeMultiplier}x Surge
                        </span>
                      )}
                    </div>
                    
                    <div className="space-y-1 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <span>Base fare</span>
                        <span>${fareEstimate.baseFare.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Distance ({fareEstimate.distance} mi)</span>
                        <span>${fareEstimate.distanceFee.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Time (~{fareEstimate.estimatedDuration} min)</span>
                        <span>${fareEstimate.timeFee.toFixed(2)}</span>
                      </div>
                      {fareEstimate.surgeMultiplier > 1 && (
                        <div className="flex justify-between text-red-600">
                          <span>Surge pricing</span>
                          <span>+${(fareEstimate.totalEstimated - fareEstimate.subtotal).toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="border-t pt-2 flex justify-between items-center">
                      <div>
                        <span className="font-bold text-lg">${fareEstimate.totalEstimated.toFixed(2)}</span>
                        <div className="text-xs text-green-600">
                          🌱 Save {fareEstimate.carbonSaved} kg CO₂
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isBookingRide || !userLocation || !fareEstimate}
                  className="w-full bg-black text-white py-4 px-6 rounded-lg font-medium hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
                >
                  {isBookingRide ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                      <span>Finding Driver...</span>
                    </div>
                  ) : fareEstimate ? (
                    `Book for $${fareEstimate.totalEstimated.toFixed(2)}`
                  ) : (
                    'Enter addresses to see fare'
                  )}
                </button>
              </form>
            </div>
          ) : (
            /* Book Ride Button */
            <button
              onClick={() => setShowBookingForm(true)}
              className="w-full bg-black text-white py-4 px-6 rounded-2xl font-medium text-lg shadow-2xl hover:bg-gray-800"
            >
              🚗 Where to? 📍
            </button>
          )}
        </div>
      )}

      {/* User Location Indicator */}
      {userLocation && (
        <div className="absolute bottom-32 right-4 z-40">
          <button className="bg-white p-3 rounded-full shadow-lg hover:bg-gray-50">
            <span className="text-blue-600 text-xl">📍</span>
          </button>
        </div>
      )}



      {/* Searching for Driver Overlay */}
      {isSearchingForDriver && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center z-50 transition-opacity duration-300">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mb-4"></div>
          <h2 className="text-white text-2xl font-semibold mb-2">
            Searching for Drivers
          </h2>
          <p className="text-gray-300 text-lg">
            Hold tight! We're finding the best ride for you.
          </p>
        </div>
      )}
    </div>
  )
}