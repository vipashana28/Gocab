'use client'

import { useEffect, useState, useMemo } from 'react'
import { useGoCabAuth } from '@/lib/auth/use-gocab-auth-google'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import MapView from '@/components/Map/MapView'
import FareEstimation from '@/components/FareEstimation'
import { usePusher } from '@/lib/hooks/use-pusher'

import { geocodeAddress, getBestGeocodeResult, validateAddressInput, formatLocationForDisplay } from '@/lib/geocoding'

interface ActiveRide {
  id: string
  rideId: string
  pickupCode: string
  otp?: string
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
  matchedAt?: Date
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
  const { 
    isConnected, 
    connectionError, 
    joinAsRider, 
    onRideStatusUpdate 
  } = usePusher()
  
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
  const [routeData, setRouteData] = useState<any>(null)
  // const [isCalculatingFare, setIsCalculatingFare] = useState(false) // Now handled by FareEstimation component
  const [isSearchingForDriver, setIsSearchingForDriver] = useState(false)
  const [isFirstLoad, setIsFirstLoad] = useState(true)
  const [fareError, setFareError] = useState<string | null>(null)
  const [showCompletionScreen, setShowCompletionScreen] = useState(false)
  const [completedRideData, setCompletedRideData] = useState<any>(null)
  
  // Location disambiguation states
  const [pickupOptions, setPickupOptions] = useState<any[]>([])
  const [destinationOptions, setDestinationOptions] = useState<any[]>([])
  const [showPickupOptions, setShowPickupOptions] = useState(false)
  const [showDestinationOptions, setShowDestinationOptions] = useState(false)
  const [isSelectingFromDropdown, setIsSelectingFromDropdown] = useState(false)
  const [pickupSearchCompleted, setPickupSearchCompleted] = useState(false)
  const [destinationSearchCompleted, setDestinationSearchCompleted] = useState(false)
  const [isSearchingPickup, setIsSearchingPickup] = useState(false)
  const [isSearchingDestination, setIsSearchingDestination] = useState(false)


  // Memoize map markers to prevent re-renders with proper coordinate guards
  const markers: MapMarker[] = useMemo(() => {
    const allMarkers: MapMarker[] = []
    if (activeRide) {
      // Pickup marker - with coordinate safety checks
      if (activeRide.pickup?.coordinates && 
          typeof activeRide.pickup.coordinates.latitude === 'number' && 
          typeof activeRide.pickup.coordinates.longitude === 'number' &&
          Number.isFinite(activeRide.pickup.coordinates.latitude) &&
          Number.isFinite(activeRide.pickup.coordinates.longitude)) {
        allMarkers.push({
          position: [
            activeRide.pickup.coordinates.latitude,
            activeRide.pickup.coordinates.longitude,
          ],
          popupText: 'Pickup Location',
          icon: 'pickup',
        })
      }
      
      // Destination marker - with coordinate safety checks
      if (activeRide.destination?.coordinates && 
          typeof activeRide.destination.coordinates.latitude === 'number' && 
          typeof activeRide.destination.coordinates.longitude === 'number' &&
          Number.isFinite(activeRide.destination.coordinates.latitude) &&
          Number.isFinite(activeRide.destination.coordinates.longitude)) {
        allMarkers.push({
          position: [
            activeRide.destination.coordinates.latitude,
            activeRide.destination.coordinates.longitude,
          ],
          popupText: 'Destination',
          icon: 'destination',
        })
      }
      
      // Driver marker - with coordinate safety checks
      if (activeRide.driverLocation?.coordinates && 
          typeof activeRide.driverLocation.coordinates.latitude === 'number' && 
          typeof activeRide.driverLocation.coordinates.longitude === 'number' &&
          Number.isFinite(activeRide.driverLocation.coordinates.latitude) &&
          Number.isFinite(activeRide.driverLocation.coordinates.longitude)) {
        allMarkers.push({
          position: [
            activeRide.driverLocation.coordinates.latitude,
            activeRide.driverLocation.coordinates.longitude,
          ],
          popupText: `Driver: ${activeRide.driverContact?.name || 'Unknown'}`,
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

  // WebSocket connection and real-time ride status updates
  useEffect(() => {
    if (isAuthenticated && user?.id && isConnected) {
      console.log('🧑‍🤝‍🧑 Rider joining WebSocket as:', user.id)
      joinAsRider(user.id)
      
      // Listen for ride status updates
      const unsubscribeStatusUpdates = onRideStatusUpdate((rideData: any) => {
        console.log('📱 Ride status update received:', rideData)
        
        // Update active ride with new status
        setActiveRide(prev => {
          if (prev && (prev.id === rideData.id || prev.rideId === rideData.rideId)) {
            const updatedRide = {
              ...prev,
              ...rideData,
              status: rideData.status,
              statusDisplay: rideData.statusDisplay,
              driverContact: rideData.driverContact || prev.driverContact,
              driverLocation: rideData.driverLocation || prev.driverLocation,
              matchedAt: rideData.matchedAt ? new Date(rideData.matchedAt) : prev.matchedAt,
              otp: rideData.otp || prev.otp
            }
            
            console.log('✅ Updated active ride with driver info:', updatedRide)
            return updatedRide
          }
          return prev
        })
        
        // Stop searching for driver if ride is matched
        if (rideData.status === 'matched' && isSearchingForDriver) {
          setIsSearchingForDriver(false)
          console.log('✅ Driver found via Pusher! Driver:', rideData.driverContact?.name, 'OTP:', rideData.otp)
        }
      })
      
      return () => {
        console.log('🧹 Cleaning up rider WebSocket listeners')
        unsubscribeStatusUpdates()
      }
    }
  }, [isAuthenticated, user?.id, isConnected, joinAsRider, onRideStatusUpdate, isSearchingForDriver])

  // Get user location
  useEffect(() => {
    if (isAuthenticated && user) {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const currentLocation = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            }
            setUserLocation(currentLocation)
            setLocationError(null)
            
            // Set current location as pickup coordinates
            setPickupCoordinates(currentLocation)
            
            // Reverse geocode to get address for pickup
            try {
              const response = await fetch(`/api/geocoding?lat=${currentLocation.latitude}&lon=${currentLocation.longitude}&reverse=true`)
              const data = await response.json()
              if (data.success && data.data?.length > 0 && data.data[0]?.address) {
                const address = data.data[0].address
                setPickupAddress(address)
                console.log('✅ Pickup address set:', address)
              } else {
                // Fallback if reverse geocoding fails
                const fallbackAddress = `Current Location (${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)})`
                setPickupAddress(fallbackAddress)
                console.log('✅ Pickup address set (fallback):', fallbackAddress)
              }
            } catch (error) {
              console.warn('Failed to reverse geocode current location:', error)
              // Fallback if reverse geocoding fails
              const fallbackAddress = `Current Location (${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)})`
              setPickupAddress(fallbackAddress)
              console.log('✅ Pickup address set (fallback):', fallbackAddress)
            }
            
            console.log('✅ User location obtained and set as pickup:', position.coords)
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
          const response = await fetch(`/api/rides?userId=${user.id}&status=requested,matched,driver_en_route,arrived,in_progress`)
          if (response.ok) {
            const data = await response.json()
            if (data.success && data.data.length > 0) {
              const rideData = data.data[0]
              
              // Update with real ride data from database
              setActiveRide(rideData)
              
              // If driver was just matched, stop searching
              if (rideData.status === 'matched' && isSearchingForDriver) {
                setIsSearchingForDriver(false)
                console.log('✅ Driver found! OTP:', rideData.otp)
              }
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
      
      // Only poll when WebSocket is not connected and not on first load
      if (!isConnected && !isFirstLoad && (!activeRide || activeRide.status === 'requested')) {
        console.log('⚠️ WebSocket not connected, using polling fallback for ride status')
        const interval = setInterval(checkActiveRides, 2000) // Faster fallback polling
        return () => clearInterval(interval)
      } else if (isConnected && !isFirstLoad) {
        console.log('✅ WebSocket connected, disabling ride status polling')
      }
    }
  }, [isAuthenticated, user, isFirstLoad, activeRide?.status])

  // Handle location input with disambiguation
  const handleLocationInput = async (address: string, type: 'pickup' | 'destination') => {
    if (!address.trim()) {
      if (type === 'pickup') {
        setPickupOptions([])
        setShowPickupOptions(false)
        setIsSearchingPickup(false)
      } else {
        setDestinationOptions([])
        setShowDestinationOptions(false)
        setIsSearchingDestination(false)
      }
      return
    }

    // Set loading state
    if (type === 'pickup') {
      setIsSearchingPickup(true)
    } else {
      setIsSearchingDestination(true)
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
          // Calculate distance to user for each result and sort by proximity with coordinate guards
          filteredResults = data.data.map((location: any) => {
            let distance = Infinity // Default to far distance if coordinates invalid
            
            if (location.coordinates && 
                userLocation &&
                typeof location.coordinates.latitude === 'number' &&
                typeof location.coordinates.longitude === 'number' &&
                typeof userLocation.latitude === 'number' &&
                typeof userLocation.longitude === 'number' &&
                Number.isFinite(location.coordinates.latitude) &&
                Number.isFinite(location.coordinates.longitude) &&
                Number.isFinite(userLocation.latitude) &&
                Number.isFinite(userLocation.longitude)) {
              distance = Math.sqrt(
                Math.pow(location.coordinates.latitude - userLocation.latitude, 2) +
                Math.pow(location.coordinates.longitude - userLocation.longitude, 2)
              )
            }
            
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
          setPickupSearchCompleted(true)
          setIsSearchingPickup(false)
        } else {
          setDestinationOptions(filteredResults.slice(0, 5)) // Limit to top 5 results
          setShowDestinationOptions(filteredResults.length > 1)
          setDestinationSearchCompleted(true)
          setIsSearchingDestination(false)
        }
      } else {
        // Mark search as completed even if no results found
        if (type === 'pickup') {
          setPickupOptions([])
          setShowPickupOptions(false)
          setPickupSearchCompleted(true)
          setIsSearchingPickup(false)
        } else {
          setDestinationOptions([])
          setShowDestinationOptions(false)
          setDestinationSearchCompleted(true)
          setIsSearchingDestination(false)
        }
      }
    } catch (error) {
      console.error('Error fetching location options:', error)
      // Mark search as completed even on error
      if (type === 'pickup') {
        setPickupSearchCompleted(true)
        setIsSearchingPickup(false)
      } else {
        setDestinationSearchCompleted(true)
        setIsSearchingDestination(false)
      }
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

  // Note: Fare calculation is now completely handled by FareEstimation component
  // This function has been removed to prevent conflicts

  // Note: Retry functionality is now handled within FareEstimation component

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
      setPickupSearchCompleted(false) // Reset search state when typing
      setIsSearchingPickup(false) // Reset loading state
    }
  }, [pickupAddress, isSelectingFromDropdown])

  useEffect(() => {
    if (!isSelectingFromDropdown) {
      setDestinationCoordinates(null)
      setDestinationSearchCompleted(false) // Reset search state when typing
      setIsSearchingDestination(false) // Reset loading state
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

  // Note: Fare calculation is now handled by FareEstimation component
  // This effect is disabled to prevent conflicts
  /*
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (pickupAddress && destinationAddress && !showPickupOptions && !showDestinationOptions) {
        calculateFareEstimate(pickupAddress, destinationAddress)
      } else {
        setFareEstimate(null)
        setFareError(null)
      }
    }, 1500)

    return () => clearTimeout(debounceTimer)
  }, [pickupAddress, destinationAddress, showPickupOptions, showDestinationOptions])
  */

  // Load ride history
  
  // Real-time driver location tracking for active rides
  useEffect(() => {
    if (activeRide && activeRide.status !== 'completed' && activeRide.status !== 'cancelled') {
      const interval = setInterval(() => {
        // Simulate driver movement towards pickup location with coordinate guards
        if (activeRide.driverLocation?.coordinates && 
            activeRide.pickup?.coordinates &&
            typeof activeRide.driverLocation.coordinates.latitude === 'number' &&
            typeof activeRide.driverLocation.coordinates.longitude === 'number' &&
            typeof activeRide.pickup.coordinates.latitude === 'number' &&
            typeof activeRide.pickup.coordinates.longitude === 'number' &&
            Number.isFinite(activeRide.driverLocation.coordinates.latitude) &&
            Number.isFinite(activeRide.driverLocation.coordinates.longitude) &&
            Number.isFinite(activeRide.pickup.coordinates.latitude) &&
            Number.isFinite(activeRide.pickup.coordinates.longitude)) {
          const driverLat = activeRide.driverLocation.coordinates.latitude
          const driverLng = activeRide.driverLocation.coordinates.longitude
          const pickupLat = activeRide.pickup.coordinates.latitude
          const pickupLng = activeRide.pickup.coordinates.longitude
          
          // Calculate direction towards pickup (simplified)
          const latDiff = pickupLat - driverLat
          const lngDiff = pickupLng - driverLng
          
          // Move driver slightly towards pickup (simulate movement)
          const moveStep = 0.0001 // Small step for gradual movement
          const newLat = driverLat + (latDiff > 0 ? moveStep : -moveStep)
          const newLng = driverLng + (lngDiff > 0 ? moveStep : -moveStep)
          
          // Update driver location
          setActiveRide(prev => prev ? {
            ...prev,
            driverLocation: {
              coordinates: { latitude: newLat, longitude: newLng },
              lastUpdated: new Date()
            }
          } : null)
          
          console.log('🚗 Driver moving towards pickup:', { lat: newLat, lng: newLng })
        }
      }, 3000) // Update every 3 seconds for visible movement

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
        
        // Note: No need for dummy driver simulation - real drivers are assigned by the API
      } else {
        const errorData = await response.json()
        
        // Handle specific "no drivers available" case
        if (errorData.error?.code === 'NO_DRIVERS_AVAILABLE') {
          alert(errorData.error.userMessage || 'No drivers around! Come back after sometime soon!')
        } else {
          alert(errorData.error?.message || 'Failed to book ride')
        }
        
        setIsSearchingForDriver(false)
        setIsBookingRide(false)
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
    
    // Show confirmation dialog
    const confirmCancel = window.confirm('Are you sure you want to cancel this ride? This action cannot be undone.')
    if (!confirmCancel) return
    
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
        
        // Store completion data and show completion screen
        setCompletedRideData({
          ...result.data,
          tripSummary: result.data.tripSummary || {
            duration: 25,
            distance: 8.5,
            carbonSaved: 2.1,
            fuelSaved: 0.8,
            treeEquivalent: 5
          },
          pickup: activeRide.pickup,
          destination: activeRide.destination
        })
        
        setActiveRide(null)
        setShowCompletionScreen(true)
      }
    } catch (error) {
      console.error('Error ending trip:', error)
      // Fallback: show completion screen with current ride data
      setCompletedRideData({
        tripSummary: {
          duration: 25,
          distance: 8.5,
          carbonSaved: 2.1,
          fuelSaved: 0.8,
          treeEquivalent: 5
        },
        pickup: activeRide.pickup,
        destination: activeRide.destination
      })
      setActiveRide(null)
      setShowCompletionScreen(true)
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
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
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

  // X (Twitter) sharing function
  const shareOnX = () => {
    if (!completedRideData?.tripSummary) return
    
    const { carbonSaved, treeEquivalent, fuelSaved } = completedRideData.tripSummary
    const tweetText = `Just completed an eco-friendly ride with @gocabs_xyz! 

• Saved ${carbonSaved}kg CO₂ emissions
• Equivalent to planting ${treeEquivalent} trees  
• Saved ${fuelSaved}L of fuel

Every ride makes a difference during @hackerhouses & @token2049! #EcoFriendly #SustainableTransport`

    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`
    window.open(tweetUrl, '_blank', 'width=550,height=420')
  }

  // Show completion screen if ride just ended
  if (showCompletionScreen && completedRideData) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-lg p-8 max-w-md w-full mx-auto border border-neutral-200">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-24 h-24 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4 border border-neutral-200">
              <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-neutral-900 mb-3">
              Thank you for choosing Go Cabs!
            </h1>
            <p className="text-lg text-neutral-600">
              Your clean-green journey is complete
            </p>
          </div>

          {/* Trip Summary */}
          <div className="bg-neutral-50 rounded-2xl p-6 mb-6">
            <h3 className="font-semibold text-neutral-900 mb-4 text-center text-lg">Trip Summary</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between text-base">
                <span className="text-neutral-700">Duration:</span>
                <span className="font-medium">{completedRideData.tripSummary.duration} minutes</span>
              </div>
              <div className="flex justify-between text-base">
                <span className="text-neutral-700">Distance:</span>
                <span className="font-medium">{completedRideData.tripSummary.distance} km</span>
              </div>
              <div className="flex justify-between text-base">
                <span className="text-neutral-700">Route:</span>
                <span className="font-medium text-sm text-right">
                  {completedRideData.pickup?.address?.split(',')[0]} → {completedRideData.destination?.address?.split(',')[0]}
                </span>
              </div>
            </div>
          </div>

          {/* Environmental Impact */}
          <div className="bg-neutral-50 rounded-2xl p-6 mb-6 border border-neutral-200">
            <div className="text-center mb-4">
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="font-semibold text-neutral-900 text-xl">Environmental Impact</h3>
              </div>
              <p className="text-neutral-600 text-base">You made a positive difference!</p>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20a7 7 0 110-14c.62 0 1.21.08 1.77.24A6 6 0 1120 13h-3a3 3 0 10-3 3H7z" />
                  </svg>
                  <span className="text-neutral-700 text-base">CO₂ emissions saved:</span>
                </div>
                <span className="font-bold text-neutral-900 text-lg">{completedRideData.tripSummary.carbonSaved}kg</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  <span className="text-neutral-700 text-base">Trees planted equivalent:</span>
                </div>
                <span className="font-bold text-neutral-900 text-lg">{completedRideData.tripSummary.treeEquivalent} trees</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <span className="text-neutral-700 text-base">Fuel saved:</span>
                </div>
                <span className="font-bold text-neutral-900 text-lg">{completedRideData.tripSummary.fuelSaved}L</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={shareOnX}
              className="w-full bg-neutral-900 text-white py-4 px-6 rounded-full font-medium hover:bg-black transition-colors flex items-center justify-center space-x-2 text-lg shadow-sm"
            >
              <span className="text-xl">𝕏</span>
              <span>Share your impact on X</span>
            </button>
            
            <button
              onClick={() => {
                setShowCompletionScreen(false)
                setCompletedRideData(null)
              }}
              className="w-full bg-green-600 text-white py-4 px-6 rounded-full font-medium hover:bg-green-700 transition-colors text-lg shadow-sm"
            >
              Book Another Eco-Ride
            </button>
          </div>

          {/* Footer */}
          <div className="text-center mt-6">
            <div className="flex items-center justify-center space-x-2">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20a7 7 0 110-14c.62 0 1.21.08 1.77.24A6 6 0 1720 13h-3a3 3 0 10-3 3H7z" />
              </svg>
              <p className="text-neutral-500 text-sm">
                Thank you for choosing sustainable transportation!
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-gray-900">
      
      {/* Full Screen Map */}
      <div className="absolute inset-0 z-0" style={{ width: '100vw', height: '100vh' }}>
        <MapView 
          key="main-map"
          center={[mapCenter.latitude, mapCenter.longitude]} 
          zoom={13}
          markers={markers}
          polylineRoute={routeData ? {
            polyline: routeData.polyline,
            color: '#2563eb',
            weight: 4,
            opacity: 0.8
          } : undefined}
          fitBounds={!!routeData}
        />
      </div>

      {/* Top Header */}
      <div className="absolute top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur border-b border-neutral-200">
        <div className="flex justify-between items-center px-2 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-white rounded-lg flex items-center justify-center shadow-sm ring-1 ring-neutral-200">
              <img 
                src="/icons/GOLOGO.svg" 
                alt="GoCabs Logo" 
                className="w-full h-full"
              />
            </div>
            <div className="leading-tight">
              <h1 className="text-lg sm:text-xl md:text-2xl font-semibold tracking-tight text-neutral-900">GoCabs</h1>
              <p className="text-xs sm:text-sm text-neutral-500">Eco-friendly rides</p>
            </div>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2">
            <button 
              onClick={() => window.location.href = '/events'}
              className="inline-flex items-center gap-2 rounded-full border border-neutral-200 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition"
            >
              Events
            </button>
            <span className="text-sm sm:text-base text-neutral-600 hidden md:inline">Hi, {user?.firstName}!</span>
            <button 
              onClick={handleSignOut}
              className="inline-flex items-center rounded-full bg-neutral-900 text-white px-4 sm:px-5 py-1.5 sm:py-2.5 text-xs sm:text-base font-medium hover:bg-black transition shadow-sm"
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
          <div className="bg-neutral-800 text-white text-center py-4 px-4">
            <div>
              <p className="text-sm font-medium">Your Pickup Code</p>
              <p className="text-2xl sm:text-3xl font-bold tracking-widest">{activeRide.pickupCode}</p>
            </div>
            <p className="text-sm opacity-90 mt-2">
              Share this code with your driver
            </p>
          </div>

          {/* Driver Info Card */}
          <div className="bg-white rounded-t-3xl shadow-lg p-4 sm:p-6 max-h-80 overflow-y-auto border border-neutral-200">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-neutral-200 rounded-full overflow-hidden">
                  {activeRide.driverContact?.photo ? (
                    <img 
                      src={activeRide.driverContact.photo} 
                      alt="Driver" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-neutral-300 flex items-center justify-center">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-base sm:text-lg text-neutral-900">{activeRide.driverContact?.name || 'Driver'}</h3>
                  <p className="text-sm text-neutral-600">{activeRide.driverContact?.vehicleInfo}</p>
                  <p className="text-sm font-medium text-neutral-800">{activeRide.driverContact?.licensePlate}</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-neutral-100 text-neutral-800 border border-neutral-200">
                {activeRide.statusDisplay}
              </span>
            </div>

            {/* Estimated Arrival */}
            {activeRide.estimatedArrival && (
              <div className="bg-neutral-50 rounded-lg p-3 mb-4 border border-neutral-200">
                <p className="text-sm text-neutral-700">
                  <span className="font-medium">
                    {activeRide.status === 'arrived' ? 'Status:' : 'Arriving in:'}
                  </span> {activeRide.estimatedArrival}
                </p>
                {activeRide.driverLocation && (
                  <div className="flex items-center space-x-1 text-xs text-neutral-600 mt-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>Location updated {new Date(activeRide.driverLocation.lastUpdated).toLocaleTimeString()}</span>
                  </div>
                )}
              </div>
            )}

            {/* Trip Details */}
            <div className="space-y-3 mb-4">
              <div className="flex items-start space-x-3">
                <div className="w-3 h-3 bg-neutral-400 rounded-full mt-1"></div>
                <div>
                  <p className="text-sm text-neutral-600">Pickup</p>
                  <p className="font-medium text-neutral-900">{activeRide.pickup.address}</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-3 h-3 bg-neutral-600 rounded-full mt-1"></div>
                <div>
                  <p className="text-sm text-neutral-600">Destination</p>
                  <p className="font-medium text-neutral-900">{activeRide.destination.address}</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {/* Start Trip Button - Show when driver has arrived */}
              {activeRide.status === 'arrived' && (
                <button
                  onClick={handleStartTrip}
                  className="w-full bg-neutral-900 text-white py-3 sm:py-4 px-4 sm:px-6 rounded-full font-medium text-base sm:text-lg hover:bg-black transition-colors shadow-sm"
                >
                  Start Trip
                </button>
              )}
              
              {/* End Trip Button - Show when trip is in progress */}
              {activeRide.status === 'in_progress' && (
                <button
                  onClick={handleEndTrip}
                  className="w-full bg-neutral-900 text-white py-3 sm:py-4 px-4 sm:px-6 rounded-full font-medium text-base sm:text-lg hover:bg-black transition-colors shadow-sm"
                >
                  End Trip
                </button>
              )}
              
              {/* Standard Action Buttons - Show for other statuses */}
              {activeRide.status !== 'in_progress' && (
            <div className="flex space-x-2 sm:space-x-3">
              <button
                onClick={callDriver}
                className="flex-1 bg-neutral-900 text-white py-2.5 sm:py-3 px-3 sm:px-4 rounded-full font-medium text-sm sm:text-base hover:bg-black flex items-center justify-center transition-colors shadow-sm"
              >
                <span>Call Driver</span>
              </button>
              <button
                onClick={handleEndTrip}
                className="flex-1 bg-neutral-600 text-white py-2.5 sm:py-3 px-3 sm:px-4 rounded-full font-medium text-sm sm:text-base hover:bg-neutral-700 transition-colors shadow-sm"
              >
                End Ride
              </button>
                </div>
              )}
            </div>

            {/* Carbon Savings */}
            <div className="mt-4 text-center">
              <div className="flex items-center justify-center space-x-1">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20a7 7 0 110-14c.62 0 1.21.08 1.77.24A6 6 0 1720 13h-3a3 3 0 10-3 3H7z" />
                </svg>
                <p className="text-sm text-neutral-600">
                  You'll save <span className="font-medium text-green-600">{activeRide.carbonFootprint.estimatedSaved}kg CO₂</span> with this ride
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Book Ride Button & Form */
        <div className="absolute bottom-0 left-0 right-0 z-50 md:bottom-6 md:left-4 md:right-4">
          
          {showBookingForm ? (
            /* Booking Form */
            <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl p-4 md:p-6 max-h-[80vh] overflow-y-auto"
                 style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Book a Ride</h2>
                <button
                  onClick={() => setShowBookingForm(false)}
                  className="text-gray-500 hover:text-neutral-700 text-xl"
                >
                  ✕
                </button>
              </div>
              
              <form onSubmit={handleBookRide} className="space-y-4">
                <div className="location-input-container">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pickup Location
                  </label>
                  <input
                    type="text"
                    value={pickupAddress || ''}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    placeholder="Enter pickup address"
                    className="w-full p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  
                  {/* Pickup Location Options Dropdown */}
                  {(pickupAddress && pickupAddress.length >= 2 && (pickupOptions.length > 0 || isSearchingPickup || (pickupSearchCompleted && pickupAddress.length >= 3))) && (
                    <div className="w-full mt-2 mb-4 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {pickupOptions.length > 0 ? (
                        pickupOptions.map((option, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => selectLocation(option, 'pickup')}
                            className="w-full px-3 py-2 text-left hover:bg-neutral-100 border-b border-neutral-100 last:border-b-0"
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
                        <>
                          {isSearchingPickup && pickupAddress && pickupAddress.length >= 2 && (
                            <div className="px-3 py-2 text-sm text-gray-500 flex items-center space-x-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                              <span>Searching locations...</span>
                            </div>
                          )}
                          {pickupAddress && pickupAddress.length >= 3 && pickupSearchCompleted && !isSearchingPickup && (
                            <div className="px-3 py-2 text-sm text-gray-500">
                              No suggestions found. Try adding city/area name.
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="location-input-container">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Destination
                  </label>
                  <input
                    type="text"
                    value={destinationAddress || ''}
                    onChange={(e) => setDestinationAddress(e.target.value)}
                    placeholder="Where to?"
                    className="w-full p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  
                  {/* Destination Location Options Dropdown */}
                  {(destinationAddress && destinationAddress.length >= 2 && (destinationOptions.length > 0 || isSearchingDestination || (destinationSearchCompleted && destinationAddress.length >= 3))) && (
                    <div className="w-full mt-2 mb-4 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {destinationOptions.length > 0 ? (
                        destinationOptions.map((option, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => selectLocation(option, 'destination')}
                            className="w-full px-3 py-2 text-left hover:bg-neutral-100 border-b border-neutral-100 last:border-b-0"
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
                        <>
                          {isSearchingDestination && destinationAddress && destinationAddress.length >= 2 && (
                            <div className="px-3 py-2 text-sm text-gray-500 flex items-center space-x-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                              <span>Searching locations...</span>
                            </div>
                          )}
                          {destinationAddress && destinationAddress.length >= 3 && destinationSearchCompleted && !isSearchingDestination && (
                            <div className="px-3 py-2 text-sm text-gray-500">
                              No suggestions found. Try adding city/area name.
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Note: Fare error display and loading are now handled by FareEstimation component */}

                {/* Fare Estimation Component - Only show when both addresses are meaningful */}
                {pickupAddress && pickupAddress.length > 5 && destinationAddress && destinationAddress.length > 5 ? (
                  <FareEstimation 
                    pickup={{
                      address: pickupAddress,
                      coordinates: pickupCoordinates || userLocation
                    }}
                    destination={{
                      address: destinationAddress,
                      coordinates: destinationCoordinates
                    }}
                    onRouteCalculated={(routeInfo) => {
                      setFareEstimate(routeInfo.fareEstimate)
                      setRouteData(routeInfo)
                      setFareError(null)
                    }}
                  />
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-center text-gray-500">
                      <div className="text-sm">
                        {!pickupAddress || pickupAddress.length <= 5 ? 
                          'Waiting for pickup location...' : 
                          'Enter destination to see fare estimate'}
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isBookingRide || !userLocation || !fareEstimate || !!fareError}
                  className="w-full bg-green-600 text-white py-4 px-6 rounded-full font-medium hover:bg-green-700 disabled:bg-neutral-400 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  {isBookingRide ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                      <span>Finding Driver...</span>
                    </div>
                  ) : fareEstimate ? (
                    'Book Eco-Friendly Ride'
                  ) : (
                    'Enter destination to see impact'
                  )}
                </button>
              </form>
            </div>
          ) : (
            /* Book Ride Button */
            <button
              onClick={() => setShowBookingForm(true)}
              className="w-full bg-green-600 text-white py-4 px-6 rounded-full font-medium text-lg shadow-sm hover:bg-green-700 flex items-center justify-center space-x-2 transition"
            >
              
              <span>Your Go Cabs Ride Awaits </span>
            </button>
          )}
        </div>
      )}

      {/* User Location Indicator */}
      {userLocation && (
        <div className="absolute bottom-32 right-4 z-40">
          <button className="bg-white p-3 rounded-full shadow-lg hover:bg-neutral-50">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      )}



      {/* Searching for Driver Overlay */}
      {isSearchingForDriver && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center z-50 transition-opacity duration-300 px-4">
          <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-b-2 border-white mb-4"></div>
          <h2 className="text-white text-xl sm:text-2xl font-semibold mb-2 text-center">
            Searching for Drivers
          </h2>
          <p className="text-neutral-300 text-base sm:text-lg text-center">
            Hold tight! We're finding the best ride for you.
          </p>
        </div>
      )}
    </div>
  )
}