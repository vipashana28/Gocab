'use client'

import { useEffect, useState, useMemo } from 'react'
import { useGoCabAuth } from '@/lib/auth/use-gocab-auth-google'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import MapView from '@/components/Map/MapView'
import FareEstimation from '@/components/FareEstimation'
import { useSocket } from '@/lib/hooks/use-socket'

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
  } = useSocket()
  
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
          if (prev && prev.id === rideData.id) {
            return {
              ...prev,
              ...rideData,
              status: rideData.status,
              statusDisplay: rideData.statusDisplay,
              driverContact: rideData.driverContact || prev.driverContact,
              driverLocation: rideData.driverLocation || prev.driverLocation,
              matchedAt: rideData.matchedAt || prev.matchedAt
            }
          }
          return prev
        })
        
        // Stop searching for driver if ride is matched
        if (rideData.status === 'matched' && isSearchingForDriver) {
          setIsSearchingForDriver(false)
          console.log('✅ Driver found via WebSocket! OTP:', rideData.otp)
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

  // X (Twitter) sharing function
  const shareOnX = () => {
    if (!completedRideData?.tripSummary) return
    
    const { carbonSaved, treeEquivalent, fuelSaved } = completedRideData.tripSummary
    const tweetText = `🌱 Just completed an eco-friendly ride with @gocabs_xyz! 

🌍 Saved ${carbonSaved}kg CO₂ emissions
🌳 Equivalent to planting ${treeEquivalent} trees  
⛽ Saved ${fuelSaved}L of fuel

Every ride makes a difference during @hackerhouses & @token2049! 🚗💚`

    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`
    window.open(tweetUrl, '_blank', 'width=550,height=420')
  }

  // Show completion screen if ride just ended
  if (showCompletionScreen && completedRideData) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full mx-auto border border-green-200">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">🎉</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Thank you for choosing GoCabs!
            </h1>
            <p className="text-gray-600">
              Your eco-friendly journey is complete
            </p>
          </div>

          {/* Trip Summary */}
          <div className="bg-green-50 rounded-2xl p-6 mb-6">
            <h3 className="font-semibold text-gray-900 mb-4 text-center">Trip Summary</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Duration:</span>
                <span className="font-medium">{completedRideData.tripSummary.duration} minutes</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Distance:</span>
                <span className="font-medium">{completedRideData.tripSummary.distance} km</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Route:</span>
                <span className="font-medium text-xs text-right">
                  {completedRideData.pickup?.address?.split(',')[0]} → {completedRideData.destination?.address?.split(',')[0]}
                </span>
              </div>
            </div>
          </div>

          {/* Environmental Impact */}
          <div className="bg-green-100 rounded-2xl p-6 mb-6">
            <div className="text-center mb-4">
              <h3 className="font-semibold text-green-800 text-lg">🌍 Environmental Impact</h3>
              <p className="text-green-700 text-sm">You made a positive difference!</p>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-green-700 text-sm">🌱 CO₂ emissions saved:</span>
                <span className="font-bold text-green-800">{completedRideData.tripSummary.carbonSaved}kg</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-green-700 text-sm">🌳 Trees planted equivalent:</span>
                <span className="font-bold text-green-800">{completedRideData.tripSummary.treeEquivalent} trees</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-green-700 text-sm">⛽ Fuel saved:</span>
                <span className="font-bold text-green-800">{completedRideData.tripSummary.fuelSaved}L</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={shareOnX}
              className="w-full bg-black text-white py-4 px-6 rounded-2xl font-medium hover:bg-gray-800 transition-colors flex items-center justify-center space-x-2"
            >
              <span className="text-xl">𝕏</span>
              <span>Share your impact on X</span>
            </button>
            
            <button
              onClick={() => {
                setShowCompletionScreen(false)
                setCompletedRideData(null)
              }}
              className="w-full bg-green-600 text-white py-4 px-6 rounded-2xl font-medium hover:bg-green-700 transition-colors"
            >
              Book Another Eco-Ride
            </button>
          </div>

          {/* Footer */}
          <div className="text-center mt-6">
            <p className="text-gray-500 text-xs">
              Thank you for choosing sustainable transportation! 🌱
            </p>
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
      <div className="absolute top-0 left-0 right-0 z-50 bg-white shadow-sm border-b">
        <div className="flex justify-between items-center px-4 py-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8">
              <img 
                src="/icons/GOLOGO.svg" 
                alt="GoCabs Logo" 
                className="w-full h-full"
              />
            </div>
          <h1 className="text-lg font-bold text-gray-900">GoCabs.xyz</h1>
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
          
          {/* Pickup Code & OTP Banner */}
          <div className="bg-green-500 text-white text-center py-4 px-4">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <p className="text-sm font-medium">Your Pickup Code</p>
                <p className="text-3xl font-bold tracking-widest">{activeRide.pickupCode}</p>
              </div>
              {activeRide.otp && activeRide.status !== 'requested' && (
                <div className="border-t border-green-400 pt-3">
                  <p className="text-sm font-medium">Ride OTP</p>
                  <p className="text-2xl font-bold tracking-widest">{activeRide.otp}</p>
                </div>
              )}
            </div>
            <p className="text-sm opacity-90 mt-2">
              {activeRide.otp && activeRide.status !== 'requested' ? 
                'Share both codes with your driver for verification' : 
                'Share this code with your driver'
              }
            </p>
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
                onClick={handleEndTrip}
                className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700"
              >
                End Ride
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
        <div className="absolute bottom-0 left-0 right-0 z-50 md:bottom-6 md:left-4 md:right-4">
          
          {showBookingForm ? (
            /* Booking Form */
            <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl p-4 md:p-6 max-h-[80vh] overflow-y-auto"
                 style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
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
                <div className="location-input-container">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pickup Location
                  </label>
                  <input
                    type="text"
                    value={pickupAddress || ''}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    placeholder="Enter pickup address"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  
                  {/* Pickup Location Options Dropdown */}
                  {(pickupAddress && pickupAddress.length >= 2 && (pickupOptions.length > 0 || isSearchingPickup || (pickupSearchCompleted && pickupAddress.length >= 3))) && (
                    <div className="w-full mt-2 mb-4 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
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
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  
                  {/* Destination Location Options Dropdown */}
                  {(destinationAddress && destinationAddress.length >= 2 && (destinationOptions.length > 0 || isSearchingDestination || (destinationSearchCompleted && destinationAddress.length >= 3))) && (
                    <div className="w-full mt-2 mb-4 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
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
                  className="w-full bg-green-600 text-white py-4 px-6 rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
                >
                  {isBookingRide ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                      <span>Finding Driver...</span>
                    </div>
                  ) : fareEstimate ? (
                    `🌱 Book Eco-Friendly Ride`
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
              className="w-full bg-green-600 text-white py-4 px-6 rounded-2xl font-medium text-lg shadow-2xl hover:bg-green-700"
            >
              🌱 Where to? (Eco-Friendly)
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