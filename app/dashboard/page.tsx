'use client'

import { useEffect, useState, useMemo } from 'react'
import { useGoCabAuth } from '@/lib/auth/use-gocab-auth-google'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import MapView from '@/components/Map/MapView'
import { geocodeAddress, getBestGeocodeResult, validateAddressInput, formatLocationForDisplay } from '@/lib/geocoding'

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
  isSimulated?: boolean // Flag to identify simulated rides
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
  const [pickupCoordinates, setPickupCoordinates] = useState<{ latitude: number, longitude: number } | null>(null)
  const [destinationCoordinates, setDestinationCoordinates] = useState<{ latitude: number, longitude: number } | null>(null)
  const [userLocation, setUserLocation] = useState<{ latitude: number, longitude: number } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)

  const [fareEstimate, setFareEstimate] = useState<any>(null)
  const [isCalculatingFare, setIsCalculatingFare] = useState(false)
  const [isSearchingForDriver, setIsSearchingForDriver] = useState(false)
  const [isFirstLoad, setIsFirstLoad] = useState(true)
  const [fareError, setFareError] = useState<string | null>(null)
  
  // Location disambiguation states
  const [pickupOptions, setPickupOptions] = useState<any[]>([])
  const [destinationOptions, setDestinationOptions] = useState<any[]>([])
  const [showPickupOptions, setShowPickupOptions] = useState(false)
  const [showDestinationOptions, setShowDestinationOptions] = useState(false)
  const [isSelectingFromDropdown, setIsSelectingFromDropdown] = useState(false)


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

  // Check for active rides and poll for updates
  useEffect(() => {
    const checkActiveRides = async () => {
      if (user) {
        // Clear rides on first load (fresh session)
        if (isFirstLoad) {
          try {
            await fetch(`/api/users/${user.id}/active-rides`, {
              method: 'DELETE'
            })
            setActiveRide(null)
            console.log('🧹 Cleared active rides for fresh session')
            setIsFirstLoad(false)
          } catch (error) {
            console.error('Error clearing rides on first load:', error)
            setIsFirstLoad(false)
          }
          return
        }

        // Check API for active rides
        try {
          const response = await fetch(`/api/rides?userId=${user.id}&status=active`)
          if (response.ok) {
            const data = await response.json()
            if (data.success && data.data.length > 0) {
              // Update with real ride data from database
              setActiveRide(data.data[0])
            } else {
              // Only clear activeRide if it's not a simulated ride
              if (!activeRide || !activeRide.isSimulated) {
              setActiveRide(null)
              }
              // Keep simulated rides in state (don't override with API response)
            }
          }
        } catch (error) {
          console.error('Error checking active rides:', error)
        }
      }
    }

    if (isAuthenticated && user) {
      checkActiveRides()
      
      // Only poll when not on first load
      if (!isFirstLoad) {
        const interval = setInterval(checkActiveRides, 15000) // Reduced polling frequency
      return () => clearInterval(interval)
    }
    }
  }, [isAuthenticated, user, activeRide, isFirstLoad])

  // Handle location input with disambiguation
  const handleLocationInput = async (address: string, type: 'pickup' | 'destination') => {
    if (!address.trim()) {
      if (type === 'pickup') {
        setPickupOptions([])
        setShowPickupOptions(false)
      } else {
        setDestinationOptions([])
        setShowDestinationOptions(false)
      }
      return
    }

    try {
      let geocodingUrl = `/api/geocoding?address=${encodeURIComponent(address)}`
      
      // Add user location for geographic bias
      if (userLocation) {
        geocodingUrl += `&lat=${userLocation.latitude}&lon=${userLocation.longitude}`
      }
      
      const response = await fetch(geocodingUrl)
      const data = await response.json()

      if (data.success && data.data.length > 0) {
        // Filter results to prioritize local ones if user location is available
        let filteredResults = data.data
        
        if (userLocation) {
          // Calculate distance to user for each result and sort by proximity
          filteredResults = data.data.map((location: any) => {
            const distance = Math.sqrt(
              Math.pow(location.coordinates.latitude - userLocation.latitude, 2) +
              Math.pow(location.coordinates.longitude - userLocation.longitude, 2)
            )
            return { ...location, distanceToUser: distance }
          }).sort((a: any, b: any) => a.distanceToUser - b.distanceToUser)
        }



        // Filter out very distant results to improve relevance
        if (userLocation && filteredResults.length > 3) {
          // Keep results within reasonable distance (roughly 500km)
          filteredResults = filteredResults.filter((location: any) => 
            !location.distanceToUser || location.distanceToUser < 5.0
          )
        }

        if (type === 'pickup') {
          setPickupOptions(filteredResults.slice(0, 5)) // Limit to top 5 results
          setShowPickupOptions(filteredResults.length > 1)
        } else {
          setDestinationOptions(filteredResults.slice(0, 5)) // Limit to top 5 results
          setShowDestinationOptions(filteredResults.length > 1)
        }
      } else {
        // If no results, still show feedback
        if (type === 'pickup') {
          setPickupOptions([])
          setShowPickupOptions(false)
        } else {
          setDestinationOptions([])
          setShowDestinationOptions(false)
        }
      }
    } catch (error) {
      console.error('Error fetching location options:', error)
    }
  }

  // Select a specific location from options
  const selectLocation = (location: any, type: 'pickup' | 'destination') => {
    setIsSelectingFromDropdown(true)
    
    if (type === 'pickup') {
      setPickupAddress(location.address)
      setPickupCoordinates(location.coordinates)
      setShowPickupOptions(false)
      setPickupOptions([])
    } else {
      setDestinationAddress(location.address)
      setDestinationCoordinates(location.coordinates)
      setShowDestinationOptions(false)
      setDestinationOptions([])
    }
    
    // Reset flag after state updates
    setTimeout(() => setIsSelectingFromDropdown(false), 100)
  }

  // Calculate fare estimate in real-time
  const calculateFareEstimate = async (pickup: string, destination: string) => {
    if (!pickup || !destination) {
      setFareError(null)
      return
    }

    setIsCalculatingFare(true)
    setFareError(null)
    
    try {
      let pickupCoords, destinationCoords

      // Use stored coordinates if available (from dropdown selection), otherwise geocode
      if (pickupCoordinates && destinationCoordinates) {
        pickupCoords = {
          lat: pickupCoordinates.latitude,
          lng: pickupCoordinates.longitude,
        }
        destinationCoords = {
          lat: destinationCoordinates.latitude,
          lng: destinationCoordinates.longitude,
        }
      } else {
        // Fallback to geocoding if coordinates not available
        const [pickupGeocode, destinationGeocode] = await Promise.all([
          geocodeAddress(pickup),
          geocodeAddress(destination)
        ])

        // More permissive validation with fallbacks
        if (!pickupGeocode.success && !destinationGeocode.success) {
          throw new Error('Unable to verify both addresses. Please check your internet connection.')
        }
        
        if (!pickupGeocode.success) {
          throw new Error('Unable to find pickup location. Please try a more specific pickup address.')
        }
        
        if (!destinationGeocode.success) {
          throw new Error('Unable to find destination. Please try a more specific destination address.')
        }

        if (pickupGeocode.data.length === 0) {
          throw new Error('Pickup location not found. Try adding city/state or use a landmark nearby.')
        }
        
        if (destinationGeocode.data.length === 0) {
          throw new Error('Destination not found. Try adding city/state or use a landmark nearby.')
        }

        const pickupLocation = getBestGeocodeResult(pickupGeocode.data)
        const destinationLocation = getBestGeocodeResult(destinationGeocode.data)

        if (!pickupLocation) {
          throw new Error('Pickup location unclear. Please be more specific or choose from suggestions.')
        }
        
        if (!destinationLocation) {
          throw new Error('Destination unclear. Please be more specific or choose from suggestions.')
        }

        pickupCoords = {
          lat: pickupLocation.coordinates.latitude,
          lng: pickupLocation.coordinates.longitude,
        }

        destinationCoords = {
          lat: destinationLocation.coordinates.latitude,
          lng: destinationLocation.coordinates.longitude,
        }
      }

      const response = await fetch('/api/directions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: pickupCoords,
          end: destinationCoords,
        }),
      })

      if (!response.ok) {
        throw new Error('Unable to calculate route. Please try again in a moment.')
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'No valid route found between these locations. Please try different addresses.')
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
      
      // Set user-friendly error message
      if (error instanceof Error) {
        setFareError(error.message)
      } else {
        setFareError('Unable to calculate fare. Please check your addresses and try again.')
      }
    } finally {
      setIsCalculatingFare(false)
    }
  }

  // Retry fare calculation
  const retryFareCalculation = () => {
    if (pickupAddress && destinationAddress) {
      calculateFareEstimate(pickupAddress, destinationAddress)
    }
  }

  // Handle location input with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (pickupAddress && pickupAddress.length >= 2) {
        handleLocationInput(pickupAddress, 'pickup')
      }
    }, 400) // Faster response for better UX

    return () => clearTimeout(timeoutId)
  }, [pickupAddress, userLocation])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (destinationAddress && destinationAddress.length >= 2) {
        handleLocationInput(destinationAddress, 'destination')
      }
    }, 400) // Faster response for better UX

    return () => clearTimeout(timeoutId)
  }, [destinationAddress, userLocation])

  // Clear stored coordinates when addresses are manually changed (but not when selected from dropdown)
  useEffect(() => {
    if (!isSelectingFromDropdown) {
      setPickupCoordinates(null)
    }
  }, [pickupAddress, isSelectingFromDropdown])

  useEffect(() => {
    if (!isSelectingFromDropdown) {
      setDestinationCoordinates(null)
    }
  }, [destinationAddress, isSelectingFromDropdown])

  // Close location options when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('.location-input-container')) {
        setShowPickupOptions(false)
        setShowDestinationOptions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Real-time fare calculation when addresses change
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (pickupAddress && destinationAddress && !showPickupOptions && !showDestinationOptions) {
        calculateFareEstimate(pickupAddress, destinationAddress)
      } else {
        setFareEstimate(null)
        setFareError(null) // Clear errors when addresses are incomplete
      }
    }, 1500) // Longer debounce for geocoding (1.5 seconds)

    return () => clearTimeout(debounceTimer)
  }, [pickupAddress, destinationAddress, showPickupOptions, showDestinationOptions])

  // Load ride history
  
  // Real-time driver location tracking for active rides
  useEffect(() => {
    if (activeRide && activeRide.status !== 'completed' && activeRide.status !== 'cancelled') {
      const interval = setInterval(() => {
        // TODO: Implement real driver tracking API calls
        console.log('Would fetch real driver location updates here')
      }, 5000) // Update every 5 seconds

      return () => clearInterval(interval)
    }
  }, [activeRide])

  const handleBookRide = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user || !pickupAddress || !destinationAddress) {
      alert('Please fill in all fields')
      return
    }

    // Validate addresses
    const pickupValidation = validateAddressInput(pickupAddress)
    const destinationValidation = validateAddressInput(destinationAddress)
    
    if (!pickupValidation.isValid) {
      alert(`Pickup address error: ${pickupValidation.error}`)
      return
    }
    
    if (!destinationValidation.isValid) {
      alert(`Destination address error: ${destinationValidation.error}`)
      return
    }

    setIsBookingRide(true)

    try {
      let pickup, destination

      // Use stored coordinates if available (from dropdown selection), otherwise geocode
      if (pickupCoordinates && destinationCoordinates) {
        console.log('✅ Using stored coordinates from dropdown selection')
        pickup = {
        address: pickupAddress,
          coordinates: pickupCoordinates
      }
        destination = {
        address: destinationAddress,
          coordinates: destinationCoordinates
        }
      } else {
        console.log('🔍 Geocoding addresses...')
        
        // Fallback to geocoding if coordinates not available
        const pickupGeocode = await geocodeAddress(pickupAddress)
        
        if (!pickupGeocode.success || pickupGeocode.data.length === 0) {
          alert('Could not find pickup location. Please enter a more specific address.')
          setIsBookingRide(false)
          return
        }

        const destinationGeocode = await geocodeAddress(destinationAddress)
        
        if (!destinationGeocode.success || destinationGeocode.data.length === 0) {
          alert('Could not find destination. Please enter a more specific address.')
          setIsBookingRide(false)
          return
        }

        // Get best results
        const pickupLocation = getBestGeocodeResult(pickupGeocode.data)
        const destinationLocation = getBestGeocodeResult(destinationGeocode.data)
        
        if (!pickupLocation || !destinationLocation) {
          alert('Could not determine exact locations. Please try more specific addresses.')
          setIsBookingRide(false)
          return
        }

        console.log('✅ Geocoded pickup:', pickupLocation)
        console.log('✅ Geocoded destination:', destinationLocation)

        pickup = {
          address: formatLocationForDisplay(pickupLocation),
          coordinates: pickupLocation.coordinates
        }

        destination = {
          address: formatLocationForDisplay(destinationLocation),
          coordinates: destinationLocation.coordinates
        }
      }

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
          
          // Immediately set the active ride from API response (with requested status)
          if (result.success && result.data) {
            setActiveRide({
              ...result.data,
              statusDisplay: 'Finding Driver...',
              isSimulated: false // This is a real ride from database
            })
            setIsSearchingForDriver(true)
            setIsBookingRide(false) // Now safe to turn off booking mode since we have active ride
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
                  latitude: pickup.coordinates.latitude + 0.01,
                  longitude: pickup.coordinates.longitude + 0.01
                },
                lastUpdated: new Date(),
              },
              estimatedArrival: '5 minutes',
              isSimulated: true // This is simulated driver assignment
            }
            setActiveRide(matchedRide)
            // Once a driver is found, turn off the searching UI.
            setIsSearchingForDriver(false)
        }, 3000)
      } else {
        const errorData = await response.json()
        alert(errorData.error?.message || 'Failed to book ride')
      }
    } catch (error) {
      console.error('Error booking ride:', error)
      alert('Network error while booking ride')
      setIsBookingRide(false)
    }
  }

  const handleSignOut = async () => {
    try {
      // Clear any active rides before signing out
      if (activeRide && user) {
        // Clear real rides from database
        await fetch(`/api/users/${user.id}/active-rides`, {
          method: 'DELETE'
        })
        console.log('🧹 Active rides cleared on sign out')
      }
      
      // Clear local state
      setActiveRide(null)
      setShowBookingForm(false)
      setPickupAddress('')
      setDestinationAddress('')
      setFareEstimate(null)
      setIsSearchingForDriver(false)
      
      // Sign out
      await signOut()
    } catch (error) {
      console.error('Error during sign out cleanup:', error)
      // Still proceed with sign out even if cleanup fails
      await signOut()
    }
  }

  const handleCancelRide = async () => {
    if (!activeRide) return
    
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
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8">
              <img 
                src="/icons/GOLOGO.svg" 
                alt="GoCab Logo" 
                className="w-full h-full"
              />
            </div>
          <h1 className="text-lg font-bold text-gray-900">GoCab Dashboard</h1>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => window.location.href = '/events'}
              className="text-sm bg-green-100 text-green-700 hover:bg-green-200 px-3 py-2 rounded-lg transition-colors duration-200"
            >
              Events
            </button>
            <span className="text-sm text-gray-600">Hi, {user?.firstName}!</span>
            <button 
              onClick={handleSignOut}
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
                  Start Trip
                </button>
              )}
              
              {/* End Trip Button - Show when trip is in progress */}
              {activeRide.status === 'in_progress' && (
                <button
                  onClick={handleEndTrip}
                  className="w-full bg-green-600 text-white py-4 px-6 rounded-lg font-bold text-lg hover:bg-green-700 transition-colors"
                >
                  End Trip
                </button>
              )}
              
              {/* Standard Action Buttons - Show for other statuses */}
              {activeRide.status !== 'in_progress' && (
            <div className="flex space-x-3">
              <button
                onClick={callDriver}
                className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 flex items-center justify-center"
              >
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
                <div className="relative location-input-container">
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
                  
                  {/* Pickup Location Options Dropdown */}
                  {pickupAddress.length >= 2 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      {pickupOptions.length > 0 ? (
                        pickupOptions.map((option, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => selectLocation(option, 'pickup')}
                            className="w-full px-3 py-2 text-left hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
                          >
                            <div className="font-medium text-sm text-gray-900 truncate">
                              {option.details?.road || option.details?.city || 'Unknown Location'}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {option.details?.city}, {option.details?.state}, {option.details?.country}
                            </div>
                            {userLocation && option.distanceToUser && (
                              <div className="text-xs text-blue-600">
                                ~{Math.round(option.distanceToUser * 111)} km away
                              </div>
                            )}
                          </button>
                        ))
                      ) : (
                        pickupAddress.length >= 3 && (
                          <div className="px-3 py-2 text-sm text-gray-500">
                            No suggestions found. Try adding city/area name.
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>

                <div className="relative location-input-container">
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
                  
                  {/* Destination Location Options Dropdown */}
                  {destinationAddress.length >= 2 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      {destinationOptions.length > 0 ? (
                        destinationOptions.map((option, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => selectLocation(option, 'destination')}
                            className="w-full px-3 py-2 text-left hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
                          >
                            <div className="font-medium text-sm text-gray-900 truncate">
                              {option.details?.road || option.details?.city || 'Unknown Location'}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {option.details?.city}, {option.details?.state}, {option.details?.country}
                            </div>
                            {userLocation && option.distanceToUser && (
                              <div className="text-xs text-blue-600">
                                ~{Math.round(option.distanceToUser * 111)} km away
                              </div>
                            )}
                          </button>
                        ))
                      ) : (
                        destinationAddress.length >= 3 && (
                          <div className="px-3 py-2 text-sm text-gray-500">
                            No suggestions found. Try adding city/area name.
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>

                {/* Fare Error Display */}
                {fareError && (
                  <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <div className="w-5 h-5 text-red-500 mt-0.5">
                        <svg fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-red-800 font-medium text-sm">Unable to calculate fare</h4>
                        <p className="text-red-700 text-sm mt-1">{fareError}</p>
                        <button
                          onClick={retryFareCalculation}
                          className="text-red-600 hover:text-red-800 text-sm font-medium mt-2 underline"
                        >
                          Try again
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Fare Calculation Loading */}
                {isCalculatingFare && !fareError && (
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                      <span className="text-blue-800 text-sm">Calculating fare...</span>
                    </div>
                  </div>
                )}

                {/* Fare Estimate Display */}
                {fareEstimate && !fareError && (
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
                          Save {fareEstimate.carbonSaved} kg CO₂
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isBookingRide || !userLocation || !fareEstimate || !!fareError}
                  className="w-full bg-green-600 text-white py-4 px-6 rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
                >
                  {isBookingRide ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                      <span>Finding Driver...</span>
                    </div>
                  ) : fareError ? (
                    'Fix address errors to continue'
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
              className="w-full bg-green-600 text-white py-4 px-6 rounded-2xl font-medium text-lg shadow-2xl hover:bg-green-700"
            >
              Where to?
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