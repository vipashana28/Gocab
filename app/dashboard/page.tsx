'use client'

import { useEffect, useState } from 'react'
import { useGoCabAuth } from '@/lib/auth/use-gocab-auth'
import { useRouter } from 'next/navigation'

interface ActiveRide {
  id: string
  rideId: string
  pickupCode: string
  status: string
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
}

export default function DashboardPage() {
  const { isAuthenticated, user, isLoading } = useGoCabAuth()
  const router = useRouter()
  
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null)
  const [isBookingRide, setIsBookingRide] = useState(false)
  const [pickupAddress, setPickupAddress] = useState('')
  const [destinationAddress, setDestinationAddress] = useState('')
  const [userLocation, setUserLocation] = useState<{ latitude: number, longitude: number } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/')
    }
  }, [isAuthenticated, isLoading, router])

  // Get user's current location
  useEffect(() => {
    if (isAuthenticated && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          })
          setLocationError(null)
        },
        (error) => {
          console.error('Geolocation error:', error)
          setLocationError('Unable to access your location. Please enable location services.')
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      )
    }
  }, [isAuthenticated])

  // Check for active rides
  useEffect(() => {
    const checkActiveRides = async () => {
      if (user) {
        try {
          const response = await fetch(`/api/rides?userId=${user.id}&status=requested&status=matched&status=driver_en_route&status=arrived&status=in_progress`)
          if (response.ok) {
            const data = await response.json()
            if (data.success && data.data.length > 0) {
              setActiveRide(data.data[0]) // Get the first active ride
            }
          }
        } catch (error) {
          console.error('Error checking active rides:', error)
        }
      }
    }

    if (isAuthenticated && user) {
      checkActiveRides()
      // Poll for ride updates every 30 seconds
      const interval = setInterval(checkActiveRides, 30000)
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
      // For simplicity, using user's current location as pickup coordinates
      // In production, use Google Places API to geocode addresses
      const pickup = {
        address: pickupAddress,
        coordinates: userLocation
      }

      // Mock destination coordinates (in production, geocode the address)
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
          specialRequests: []
        })
      })

      const data = await response.json()

      if (data.success) {
        setActiveRide(data.data)
        setPickupAddress('')
        setDestinationAddress('')
        alert(`Ride booked! Your pickup code is: ${data.data.pickupCode}`)
      } else {
        alert(data.error?.message || 'Failed to book ride')
      }
    } catch (error) {
      console.error('Error booking ride:', error)
      alert('Failed to book ride. Please try again.')
    } finally {
      setIsBookingRide(false)
    }
  }

  const handleCancelRide = async () => {
    if (!activeRide) return

    if (confirm('Are you sure you want to cancel this ride?')) {
      try {
        const response = await fetch(`/api/rides/${activeRide.rideId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'cancelled',
            cancelledBy: 'user',
            cancellationReason: 'Cancelled by user from dashboard'
          })
        })

        if (response.ok) {
          setActiveRide(null)
          alert('Ride cancelled successfully')
        } else {
          alert('Failed to cancel ride')
        }
      } catch (error) {
        console.error('Error cancelling ride:', error)
        alert('Failed to cancel ride')
      }
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">GoCab Dashboard</h1>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                Welcome, {user?.firstName || 'User'}!
              </div>
              <button 
                onClick={() => router.push('/')}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                Home
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Location Status */}
            <div className="card">
              <h2 className="text-xl font-semibold mb-4">📍 Your Location</h2>
              {locationError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-700">{locationError}</p>
                </div>
              ) : userLocation ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-green-700">
                    ✅ Location access enabled
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Lat: {userLocation.latitude.toFixed(6)}, 
                    Lng: {userLocation.longitude.toFixed(6)}
                  </p>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-700">🔄 Getting your location...</p>
                </div>
              )}
            </div>

            {/* Active Ride */}
            {activeRide ? (
              <div className="card">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-xl font-semibold">🚗 Active Ride</h2>
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

                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Pickup Code</p>
                    <p className="text-2xl font-bold text-primary-600">{activeRide.pickupCode}</p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-700">From</p>
                      <p className="text-gray-900">{activeRide.pickup.address}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">To</p>
                      <p className="text-gray-900">{activeRide.destination.address}</p>
                    </div>
                  </div>

                  {activeRide.driverContact && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Your Driver</p>
                      <p className="font-medium">{activeRide.driverContact.name}</p>
                      <p className="text-sm text-gray-600">{activeRide.driverContact.vehicleInfo}</p>
                      <p className="text-sm text-gray-600">License: {activeRide.driverContact.licensePlate}</p>
                      <p className="text-sm text-primary-600 font-medium">📞 {activeRide.driverContact.phone}</p>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-4 border-t">
                    <div>
                      <p className="text-sm text-gray-600">Estimated Fare</p>
                      <p className="font-semibold">${activeRide.pricing.totalEstimated.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">CO₂ Saved</p>
                      <p className="font-semibold text-green-600">{activeRide.carbonFootprint.estimatedSaved.toFixed(1)}kg</p>
                    </div>
                    <button 
                      onClick={handleCancelRide}
                      className="bg-red-100 text-red-700 hover:bg-red-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      Cancel Ride
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Book New Ride */
              <div className="card">
                <h2 className="text-xl font-semibold mb-4">🚖 Book a Ride</h2>
                
                {!userLocation ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <p className="text-yellow-700">📍 Please enable location access to book a ride</p>
                  </div>
                ) : (
                  <form onSubmit={handleBookRide} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Pickup Address
                      </label>
                      <input
                        type="text"
                        value={pickupAddress}
                        onChange={(e) => setPickupAddress(e.target.value)}
                        placeholder="Enter pickup location"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Destination Address
                      </label>
                      <input
                        type="text"
                        value={destinationAddress}
                        onChange={(e) => setDestinationAddress(e.target.value)}
                        placeholder="Enter destination"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        required
                      />
                    </div>
                    
                    <button
                      type="submit"
                      disabled={isBookingRide || !pickupAddress || !destinationAddress}
                      className="w-full btn-primary py-3"
                    >
                      {isBookingRide ? 'Booking...' : 'Book Ride'}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            
            {/* User Stats */}
            {user && (
              <div className="card">
                <h3 className="text-lg font-semibold mb-4">📊 Your Stats</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Rides</span>
                    <span className="font-semibold">{user.totalRides}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">CO₂ Saved</span>
                    <span className="font-semibold text-green-600">{user.totalCarbonSaved.toFixed(1)}kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Member Since</span>
                    <span className="font-semibold">{new Date(user.memberSince).toLocaleDateString()}</span>
                  </div>
                  {user.isSponsored && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-blue-800 text-sm font-medium">✨ Sponsored Rider</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">⚡ Quick Actions</h3>
              <div className="space-y-2">
                <button 
                  onClick={() => router.push('/events')}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  🎉 View Events
                </button>
                <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                  📱 Contact Support
                </button>
                <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                  ⚙️ Settings
                </button>
              </div>
            </div>

            {/* GPS Status */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">🛰️ GPS Status</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Location Services</span>
                  <span className={userLocation ? 'text-green-600' : 'text-red-600'}>
                    {userLocation ? '✅ Active' : '❌ Disabled'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>GPS Accuracy</span>
                  <span className="text-green-600">✅ High</span>
                </div>
                <div className="flex justify-between">
                  <span>Real-time Updates</span>
                  <span className="text-green-600">✅ Enabled</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
