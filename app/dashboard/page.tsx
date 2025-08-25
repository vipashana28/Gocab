'use client'

import { useEffect, useState } from 'react'
import { useGoCabAuth } from '@/lib/auth/use-gocab-auth-google'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import dynamic from 'next/dynamic'

// Dynamic import for map to avoid SSR issues
const MapView = dynamic(() => import('@/components/Map/MapView'), { 
  ssr: false,
  loading: () => <div className="w-full h-full bg-gray-200 animate-pulse"></div>
})

interface ActiveRide {
  id: string
  rideId: string
  pickupCode: string
  status: 'requested' | 'matched' | 'driver_en_route' | 'arrived' | 'in_progress' | 'completed'
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
      // Poll for ride updates every 10 seconds for real-time tracking
      const interval = setInterval(checkActiveRides, 10000)
      return () => clearInterval(interval)
    }
  }, [isAuthenticated, user])

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
        
        // Simulate finding a driver after 3 seconds
        setTimeout(() => {
          setActiveRide({
            ...result.data,
            status: 'matched',
            statusDisplay: 'Driver Found',
            driverContact: {
              name: 'John Smith',
              phone: '+1 (555) 123-4567',
              vehicleInfo: '2022 Toyota Camry - Blue',
              licensePlate: 'ABC-123',
              photo: 'https://i.pravatar.cc/150?u=driver-john'
            },
            driverLocation: {
              coordinates: {
                latitude: userLocation.latitude + 0.01,
                longitude: userLocation.longitude + 0.01
              },
              lastUpdated: new Date()
            },
            estimatedArrival: '5 minutes'
          })
        }, 3000)
      } else {
        const errorData = await response.json()
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
      <div className="absolute inset-0">
        <MapView 
          center={[mapCenter.latitude, mapCenter.longitude]} 
          zoom={13}
        />
      </div>

      {/* Top Header */}
      <div className="absolute top-0 left-0 right-0 z-50 bg-white shadow-sm border-b">
        <div className="flex justify-between items-center px-4 py-3">
          <h1 className="text-lg font-bold text-gray-900">GoCab Dashboard</h1>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-600">Hi, {user?.firstName}!</span>
            <button 
              onClick={() => window.location.href = '/'}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Home
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
                  <span className="font-medium">Arriving in:</span> {activeRide.estimatedArrival}
                </p>
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

                <button
                  type="submit"
                  disabled={isBookingRide || !userLocation}
                  className="w-full bg-black text-white py-4 px-6 rounded-lg font-medium hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isBookingRide ? 'Booking Ride...' : 'Book GoCab'}
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
    </div>
  )
}