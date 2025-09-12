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

  const updateDriverLocation = (rideId: string, coordinates: { latitude: number, longitude: number }, heading?: number, speed?: number) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('driver-location-update', {
        rideId,
        coordinates,
        heading,
        speed,
        timestamp: new Date()
      })
    }
  }

  const updateRideStatus = (rideId: string, status: string, statusDisplay: string, additionalInfo?: any) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('ride-status-update', {
        rideId,
        status,
        statusDisplay,
        additionalInfo
      })
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
    updateDriverLocation,
    updateRideStatus
  }
}
