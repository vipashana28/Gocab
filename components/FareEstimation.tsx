
'use client'

import { useState, useEffect, useMemo } from 'react'

interface FareEstimate {
  baseFare: number
  distanceFare: number
  timeFare: number
  surgeFare: number
  totalFare: number
  currency: string
  breakdown: {
    baseRate: number
    perKmRate: number
    perMinuteRate: number
    surgeMultiplier: number
    distance: number
    duration: number
  }
}

interface RouteData {
  distance: {
    text: string
    value: number
    km: number
  }
  duration: {
    text: string
    value: number
    minutes: number
  }
  durationInTraffic: {
    text: string
    value: number
    minutes: number
  }
  startAddress: string
  endAddress: string
  polyline: string
  fareEstimate: FareEstimate
}

interface FareEstimationProps {
  pickup?: {
    address: string
    coordinates?: { latitude: number, longitude: number } | null
  }
  destination?: {
    address: string
    coordinates?: { latitude: number, longitude: number } | null
  }
  onRouteCalculated?: (routeData: RouteData) => void
  className?: string
}

export default function FareEstimation({ 
  pickup, 
  destination, 
  onRouteCalculated,
  className = ""
}: FareEstimationProps) {
  const [routeData, setRouteData] = useState<RouteData | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isMounted, setIsMounted] = useState(true)

  // Create stable key for useEffect to prevent unnecessary re-renders with coordinate guards
  const requestKey = useMemo(() => {
    if (!pickup?.address || !destination?.address) return null
    
    // Safe coordinate access with proper validation
    const pickupKey = (pickup.coordinates && 
                      typeof pickup.coordinates.latitude === 'number' && 
                      typeof pickup.coordinates.longitude === 'number' &&
                      Number.isFinite(pickup.coordinates.latitude) &&
                      Number.isFinite(pickup.coordinates.longitude))
      ? `${pickup.coordinates.latitude},${pickup.coordinates.longitude}` 
      : pickup.address
      
    const destKey = (destination.coordinates && 
                    typeof destination.coordinates.latitude === 'number' && 
                    typeof destination.coordinates.longitude === 'number' &&
                    Number.isFinite(destination.coordinates.latitude) &&
                    Number.isFinite(destination.coordinates.longitude))
      ? `${destination.coordinates.latitude},${destination.coordinates.longitude}` 
      : destination.address
    
    return `${pickupKey}|${destKey}`
  }, [pickup?.address, pickup?.coordinates?.latitude, pickup?.coordinates?.longitude, destination?.address, destination?.coordinates?.latitude, destination?.coordinates?.longitude])

  // Calculate route and fare when both pickup and destination are available
  useEffect(() => {
    if (!pickup || !destination || !requestKey) {
      setRouteData(null)
      setError(null)
      return
    }

    // Don't calculate if addresses are too short (user still typing)
    if (!pickup.address || pickup.address.length < 10 || 
        !destination.address || destination.address.length < 10) {
      setRouteData(null)
      setError(null)
      return
    }

    // Debounce to prevent excessive API calls during typing
    const debounceTimer = setTimeout(async () => {
      if (!isMounted) return // Prevent API calls if component unmounted
      
      setIsCalculating(true)
      setError(null)

      try {
        let pickupCoords = pickup.coordinates
        let destinationCoords = destination.coordinates

        // If coordinates are missing, geocode the addresses
        if (!pickupCoords && pickup.address) {
          const geocodeResponse = await fetch(`/api/geocoding?address=${encodeURIComponent(pickup.address)}`)
          const geocodeData = await geocodeResponse.json()
          if (geocodeData.success && geocodeData.data.length > 0) {
            pickupCoords = geocodeData.data[0].coordinates
          }
        }

        if (!destinationCoords && destination.address) {
          const geocodeResponse = await fetch(`/api/geocoding?address=${encodeURIComponent(destination.address)}`)
          const geocodeData = await geocodeResponse.json()
          if (geocodeData.success && geocodeData.data.length > 0) {
            destinationCoords = geocodeData.data[0].coordinates
          }
        }

        // If we still don't have coordinates after geocoding, abort
        if (!pickupCoords || !destinationCoords) {
          if (isMounted) {
            setError('Unable to determine locations from addresses')
            setIsCalculating(false)
          }
          return
        }

        const response = await fetch('/api/directions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            origin: {
              latitude: pickupCoords.latitude,
              longitude: pickupCoords.longitude
            },
            destination: {
              latitude: destinationCoords.latitude,
              longitude: destinationCoords.longitude
            },
            travelMode: 'DRIVING',
            avoidHighways: false,
            avoidTolls: false
          })
        })

        const result = await response.json()

        if (!result.success) {
          throw new Error(result.error || 'Failed to calculate route')
        }

        // Only update state if component is still mounted
        if (isMounted) {
          setRouteData(result.data)
          onRouteCalculated?.(result.data)
        }

      } catch (err) {
        if (isMounted) {
          console.error('Route calculation error:', err)
          setError(err instanceof Error ? err.message : 'Failed to calculate fare')
          setRouteData(null)
        }
      } finally {
        if (isMounted) {
          setIsCalculating(false)
        }
      }
    }, 1000) // 1 second debounce

    return () => clearTimeout(debounceTimer)
  }, [requestKey])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setIsMounted(false)
    }
  }, [])

  if (!pickup || !destination) {
    return (
      <div className={`bg-gray-50 rounded-lg p-4 ${className}`}>
        <div className="text-center text-gray-500">
          <div className="text-sm">Select pickup and destination to see fare estimate</div>
        </div>
      </div>
    )
  }

  if (isCalculating) {
    return (
      <div className={`bg-white rounded-lg p-4 shadow-sm border ${className}`}>
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          <div className="text-gray-600">Calculating fare...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-red-50 rounded-lg p-4 border border-red-200 ${className}`}>
        <div className="text-red-700 text-sm">
          <div className="font-medium">Unable to calculate fare</div>
          <div className="mt-1">{error}</div>
        </div>
      </div>
    )
  }

  if (!routeData) {
    return null
  }

  const { fareEstimate, distance, durationInTraffic } = routeData

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold text-gray-900">
            🌱 Eco-Friendly Ride
          </div>
          <div className="text-2xl font-bold text-green-600">
            Ready to Go!
          </div>
        </div>
      </div>

      {/* Route Info */}
      <div className="p-4 border-b border-gray-100">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{distance.text}</div>
            <div className="text-sm text-gray-500">Distance</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{durationInTraffic.text}</div>
            <div className="text-sm text-gray-500">Duration</div>
          </div>
        </div>
      </div>

      {/* Environmental Impact */}
      <div className="p-4">
        <div className="bg-green-50 rounded-lg p-4 mb-4">
          <div className="flex items-center space-x-2 mb-3">
            <span className="text-2xl">🌍</span>
            <div>
              <div className="font-semibold text-green-800">Environmental Impact</div>
              <div className="text-sm text-green-600">Making a difference together</div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">🌱 CO₂ emissions saved:</span>
              <span className="font-bold text-green-600">{(fareEstimate.breakdown.distance * 0.21).toFixed(1)} kg</span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">🌳 Equivalent trees planted:</span>
              <span className="font-bold text-green-600">{Math.round(fareEstimate.breakdown.distance * 0.21 * 2.47)} trees</span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">⛽ Fuel saved:</span>
              <span className="font-bold text-green-600">{(fareEstimate.breakdown.distance * 0.08).toFixed(1)} L</span>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg p-3 mb-3">
          <div className="flex items-center space-x-2">
            <span className="text-lg">💰</span>
            <div className="text-sm">
              <div className="font-medium text-blue-800">Affordable & Eco-Friendly</div>
              <div className="text-blue-600">Shared rides reduce costs and emissions</div>
            </div>
          </div>
        </div>

        <div className="text-center">
          <div className="text-lg font-semibold text-gray-900 mb-1">Ready to make an impact?</div>
          <div className="text-sm text-gray-600">Join thousands reducing their carbon footprint</div>
        </div>
      </div>

      {/* Additional Info */}
      <div className="px-4 pb-4">
        <div className="text-xs text-gray-500 text-center">
          🚗 Shared mobility for a sustainable future 🌱
          <br />
          Carbon calculations based on EPA standards vs. private vehicle usage
        </div>
      </div>
    </div>
  )
}
