'use client'

import { useEffect, useState } from 'react'
import { useGoCabAuth } from '@/lib/auth/use-gocab-auth-google'
import { useSession } from 'next-auth/react'
import dynamic from 'next/dynamic'

// Dynamic import for map to avoid SSR issues
const MapView = dynamic(() => import('@/components/Map/MapView'), { 
  ssr: false,
  loading: () => <div className="w-full h-full bg-gray-200 animate-pulse flex items-center justify-center">Loading Map...</div>
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
      // Poll for ride updates every 10 seconds
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

  // Show loading if still checking auth
  if (isLoading || status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Loading GoCab...</p>
        </div>
      </div>
    )
  }

  // Show authentication page if not logged in
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <header className="text-center mb-12">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-4">
              Go<span className="text-primary-600">Cab</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Your eco-friendly ride is just a tap away. Track your carbon savings while getting around the city.
            </p>
            
            {/* Error Display */}
            {error && (
              <div className="mt-4 inline-flex items-center bg-red-100 text-red-800 px-4 py-2 rounded-full">
                <span className="mr-2">⚠</span>
                {error}
              </div>
            )}
          </header>

          {/* Login Options */}
          <div className="max-w-md mx-auto">
            <div className="card">
              <h2 className="text-2xl font-semibold mb-6 text-center">Ready to ride?</h2>
              <div className="space-y-4">
                <button 
                  className="btn-primary text-lg py-4 px-8 w-full"
                  disabled={isLoading}
                  onClick={() => {
                    console.log('Sign In with Google button clicked!')
                    signIn()
                  }}
                >
                  {isLoading ? 'Connecting to Google...' : 'Sign In with Google'}
                </button>
                <button 
                  className="btn-secondary text-lg py-4 px-8 w-full"
                  disabled={isLoading}
                  onClick={demoSignIn}
                >
                  {isLoading ? 'Loading...' : 'Demo Login'}
                </button>
                <p className="text-center text-sm text-gray-500">
                  Use Demo Login to test app features without Google OAuth.
                </p>
              </div>
            </div>
          </div>

          {/* Features Preview */}
          <div className="grid md:grid-cols-3 gap-6 mt-16 max-w-4xl mx-auto">
            <div className="card text-center">
              <div className="text-4xl mb-4">🚗</div>
              <h3 className="text-xl font-semibold mb-2">Easy Booking</h3>
              <p className="text-gray-600">Book your ride in seconds</p>
            </div>
            <div className="card text-center">
              <div className="text-4xl mb-4">🌱</div>
              <h3 className="text-xl font-semibold mb-2">Eco-Friendly</h3>
              <p className="text-gray-600">Track your carbon savings</p>
            </div>
            <div className="card text-center">
              <div className="text-4xl mb-4">📱</div>
              <h3 className="text-xl font-semibold mb-2">Real-Time Tracking</h3>
              <p className="text-gray-600">See driver location live</p>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // Main Uber-like interface when authenticated
  const mapCenter = userLocation || { latitude: 37.7749, longitude: -122.4194 }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-gray-900">
      
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
        />
      </div>

      {/* Top Header - Higher z-index */}
      <div 
        className="absolute top-0 left-0 right-0 bg-white shadow-lg border-b"
        style={{ zIndex: 9999 }}
      >
        <div className="flex justify-between items-center px-4 py-3">
          <h1 className="text-lg font-bold text-gray-900">GoCab</h1>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-600">Hi, {user?.firstName}!</span>
            <button 
              onClick={() => window.location.href = '/events'}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Events
            </button>
            <button 
              onClick={signOut}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Location Error Alert */}
      {locationError && (
        <div 
          className="absolute top-16 left-4 right-4 bg-red-500 text-white p-3 rounded-lg shadow-lg"
          style={{ zIndex: 9998 }}
        >
          <p className="text-sm">{locationError}</p>
        </div>
      )}

      {/* Active Ride Status */}
      {activeRide ? (
        <div 
          className="absolute bottom-0 left-0 right-0"
          style={{ zIndex: 9997 }}
        >
          
          {/* Pickup Code Banner */}
          <div className="bg-green-500 text-white text-center py-4 px-4 shadow-lg">
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
        <div 
          className="absolute bottom-6 left-4 right-4"
          style={{ zIndex: 9997 }}
        >
          
          {showBookingForm ? (
            /* Booking Form */
            <div className="bg-white rounded-2xl shadow-2xl p-6 border border-gray-200">
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
            /* Where to? Button */
            <button
              onClick={() => setShowBookingForm(true)}
              className="w-full bg-black text-white py-4 px-6 rounded-2xl font-medium text-lg shadow-2xl hover:bg-gray-800 flex items-center justify-center space-x-2 border-2 border-white"
            >
              <span>🚗</span>
              <span>Where to?</span>
              <span>📍</span>
            </button>
          )}
        </div>
      )}

      {/* User Location Indicator */}
      {userLocation && (
        <div 
          className="absolute bottom-32 right-4"
          style={{ zIndex: 9996 }}
        >
          <button className="bg-white p-3 rounded-full shadow-lg hover:bg-gray-50 border border-gray-200">
            <span className="text-blue-600 text-xl">📍</span>
          </button>
        </div>
      )}

      {/* UI Visibility Test Indicator */}
      <div 
        className="absolute top-20 right-4 bg-green-500 text-white px-2 py-1 rounded text-xs font-mono"
        style={{ zIndex: 10000 }}
      >
        UI ✓
      </div>
    </div>
  )
}
