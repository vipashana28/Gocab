'use client'

import { useEffect, useState, useCallback } from 'react'

interface DriverLocationData {
  coordinates: {
    latitude: number
    longitude: number
  }
  heading?: number
  speed?: number
  timestamp: Date
  estimatedArrival?: string
}

interface RideStatusData {
  status: 'requested' | 'matched' | 'driver_en_route' | 'arrived' | 'in_progress' | 'completed' | 'cancelled'
  statusDisplay: string
  estimatedArrival?: string
  additionalInfo?: any
}

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  useEffect(() => {
    // Initialize connection check
    const checkConnection = async () => {
      try {
        const response = await fetch('/api/socket')
        if (response.ok) {
          console.log('⚡ Real-time service available')
          setIsConnected(true)
          setConnectionError(null)
        }
      } catch (error) {
        console.error('❌ Real-time service error:', error)
        setConnectionError('Real-time service unavailable')
        setIsConnected(false)
      }
    }

    checkConnection()
  }, [])

  const joinRide = useCallback((rideId: string) => {
    console.log('📍 Joining ride room (polling mode):', rideId)
  }, [])

  const leaveRide = useCallback((rideId: string) => {
    console.log('🚪 Leaving ride room (polling mode):', rideId)
  }, [])

  const onDriverLocationUpdate = useCallback((callback: (data: DriverLocationData) => void) => {
    // For polling mode, we'll handle this in the component
    console.log('🗒️ Driver location update listener registered (polling mode)')
    return () => {
      console.log('🧹 Driver location update listener cleaned up')
    }
  }, [])

  const onRideStatusUpdate = useCallback((callback: (data: RideStatusData) => void) => {
    // For polling mode, we'll handle this in the component  
    console.log('🗒️ Ride status update listener registered (polling mode)')
    return () => {
      console.log('🧹 Ride status update listener cleaned up')
    }
  }, [])

  const updateDriverLocation = useCallback((rideId: string, coordinates: { latitude: number, longitude: number }, heading?: number, speed?: number) => {
    // This will be handled via API calls instead of socket
    console.log('📍 Driver location update (API mode):', { rideId, coordinates })
  }, [])

  const updateRideStatus = useCallback((rideId: string, status: string, statusDisplay: string, additionalInfo?: any) => {
    // This will be handled via API calls instead of socket
    console.log('📊 Ride status update (API mode):', { rideId, status, statusDisplay })
  }, [])

  return {
    socket: null, // No actual socket for now
    isConnected,
    connectionError,
    joinRide,
    leaveRide,
    onDriverLocationUpdate,
    onRideStatusUpdate,
    updateDriverLocation,
    updateRideStatus
  }
}
