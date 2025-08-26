'use client'

import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'

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

interface DriverMatchedData {
  driverInfo: any
  status: string
  statusDisplay: string
}

interface TripCompletedData {
  status: string
  statusDisplay: string
  tripSummary: any
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  useEffect(() => {
    // Initialize socket connection
    const initSocket = async () => {
      try {
        // Initialize the socket server
        await fetch('/api/socket')
        
        // Create socket connection
        socketRef.current = io({
          path: '/api/socket',
          addTrailingSlash: false,
        })

        socketRef.current.on('connect', () => {
          console.log('🔗 Socket connected:', socketRef.current?.id)
          setIsConnected(true)
          setConnectionError(null)
        })

        socketRef.current.on('disconnect', () => {
          console.log('🔌 Socket disconnected')
          setIsConnected(false)
        })

        socketRef.current.on('connect_error', (error) => {
          console.error('❌ Socket connection error:', error)
          setConnectionError('Failed to connect to real-time service')
        })

      } catch (error) {
        console.error('❌ Socket initialization error:', error)
        setConnectionError('Failed to initialize real-time service')
      }
    }

    initSocket()

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [])

  const joinRide = (rideId: string) => {
    if (socketRef.current && isConnected) {
      console.log('📍 Joining ride room:', rideId)
      socketRef.current.emit('join-ride', rideId)
    }
  }

  const leaveRide = (rideId: string) => {
    if (socketRef.current && isConnected) {
      console.log('🚪 Leaving ride room:', rideId)
      socketRef.current.emit('leave-ride', rideId)
    }
  }

  const onDriverLocationUpdate = (callback: (data: DriverLocationData) => void) => {
    if (socketRef.current) {
      socketRef.current.on('driver-moved', callback)
      
      // Return cleanup function
      return () => {
        if (socketRef.current) {
          socketRef.current.off('driver-moved', callback)
        }
      }
    }
  }

  const onRideStatusUpdate = (callback: (data: RideStatusData) => void) => {
    if (socketRef.current) {
      socketRef.current.on('ride-status-changed', callback)
      
      return () => {
        if (socketRef.current) {
          socketRef.current.off('ride-status-changed', callback)
        }
      }
    }
  }

  const onDriverMatched = (callback: (data: DriverMatchedData) => void) => {
    if (socketRef.current) {
      socketRef.current.on('driver-matched', callback)
      
      return () => {
        if (socketRef.current) {
          socketRef.current.off('driver-matched', callback)
        }
      }
    }
  }

  const onDriverArrived = (callback: (data: RideStatusData) => void) => {
    if (socketRef.current) {
      socketRef.current.on('driver-arrived', callback)
      
      return () => {
        if (socketRef.current) {
          socketRef.current.off('driver-arrived', callback)
        }
      }
    }
  }

  const onTripStarted = (callback: (data: RideStatusData) => void) => {
    if (socketRef.current) {
      socketRef.current.on('trip-started', callback)
      
      return () => {
        if (socketRef.current) {
          socketRef.current.off('trip-started', callback)
        }
      }
    }
  }

  const onTripCompleted = (callback: (data: TripCompletedData) => void) => {
    if (socketRef.current) {
      socketRef.current.on('trip-completed', callback)
      
      return () => {
        if (socketRef.current) {
          socketRef.current.off('trip-completed', callback)
        }
      }
    }
  }

  // Simulate driver location updates for demo
  const simulateDriverMovement = (rideId: string, startLocation: { latitude: number, longitude: number }, endLocation: { latitude: number, longitude: number }) => {
    if (socketRef.current && isConnected) {
      console.log('🎬 Starting driver simulation for ride:', rideId)
      
      let currentLocation = { ...startLocation }
      const totalSteps = 20
      let currentStep = 0
      
      const latStep = (endLocation.latitude - startLocation.latitude) / totalSteps
      const lonStep = (endLocation.longitude - startLocation.longitude) / totalSteps
      
      const interval = setInterval(() => {
        if (currentStep >= totalSteps) {
          clearInterval(interval)
          
          // Emit driver arrived
          if (socketRef.current) {
            socketRef.current.emit('driver-arrived', { rideId })
          }
          return
        }
        
        currentLocation.latitude += latStep
        currentLocation.longitude += lonStep
        currentStep++
        
        const remainingTime = Math.ceil((totalSteps - currentStep) * 2 / 60)
        
        // Emit location update
        if (socketRef.current) {
          socketRef.current.emit('driver-location-update', {
            rideId,
            driverId: 'demo-driver',
            coordinates: currentLocation,
            speed: 25,
            timestamp: new Date()
          })
          
          // Also emit to local listeners for immediate UI update
          socketRef.current.emit('driver-moved', {
            coordinates: currentLocation,
            speed: 25,
            timestamp: new Date(),
            estimatedArrival: `${remainingTime} minute${remainingTime !== 1 ? 's' : ''}`
          })
        }
        
      }, 2000) // Update every 2 seconds
      
      return interval
    }
  }

  return {
    socket: socketRef.current,
    isConnected,
    connectionError,
    joinRide,
    leaveRide,
    onDriverLocationUpdate,
    onRideStatusUpdate,
    onDriverMatched,
    onDriverArrived,
    onTripStarted,
    onTripCompleted,
    simulateDriverMovement
  }
}
