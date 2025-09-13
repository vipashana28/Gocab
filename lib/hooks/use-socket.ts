'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
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
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    // Initialize Socket.IO connection
    const initSocket = async () => {
      try {
        // First, initialize the Socket.IO server
        await fetch('/api/socket')
        
        // Then connect to it
        const socket = io({
          path: '/api/socket',
          addTrailingSlash: false,
        })
        
        socketRef.current = socket
        
        socket.on('connect', () => {
          console.log('⚡ Socket.IO connected:', socket.id)
          setIsConnected(true)
          setConnectionError(null)
        })
        
        socket.on('disconnect', () => {
          console.log('🔌 Socket.IO disconnected')
          setIsConnected(false)
        })
        
        socket.on('connect_error', (error) => {
          console.error('❌ Socket.IO connection error:', error)
          setConnectionError('Real-time service unavailable')
          setIsConnected(false)
        })
        
      } catch (error) {
        console.error('❌ Socket.IO initialization error:', error)
        setConnectionError('Real-time service unavailable')
        setIsConnected(false)
      }
    }

    initSocket()
    
    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        console.log('🧹 Cleaning up Socket.IO connection')
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [])

  const joinAsDriver = useCallback((driverId: string) => {
    if (socketRef.current && isConnected) {
      console.log('🚗 Joining as driver:', driverId)
      socketRef.current.emit('driver:join', driverId)
    }
  }, [isConnected])

  const joinAsRider = useCallback((riderId: string) => {
    if (socketRef.current && isConnected) {
      console.log('🧑‍🤝‍🧑 Joining as rider:', riderId)
      socketRef.current.emit('rider:join', riderId)
    }
  }, [isConnected])

  const onNewRide = useCallback((callback: (rideData: any) => void) => {
    if (socketRef.current) {
      console.log('🗒️ Listening for new rides')
      socketRef.current.on('ride:new', callback)
      
      return () => {
        if (socketRef.current) {
          socketRef.current.off('ride:new', callback)
        }
      }
    }
    return () => {}
  }, [])

  const onNotificationSound = useCallback((callback: () => void) => {
    if (socketRef.current) {
      console.log('🔔 Listening for notification sounds')
      socketRef.current.on('notification:sound', callback)
      
      return () => {
        if (socketRef.current) {
          socketRef.current.off('notification:sound', callback)
        }
      }
    }
    return () => {}
  }, [])

  const onRideStatusUpdate = useCallback((callback: (data: RideStatusData) => void) => {
    if (socketRef.current) {
      console.log('🗒️ Listening for ride status updates')
      socketRef.current.on('ride:status_update', callback)
      
      return () => {
        if (socketRef.current) {
          socketRef.current.off('ride:status_update', callback)
        }
      }
    }
    return () => {}
  }, [])

  const onDriverLocationUpdate = useCallback((callback: (data: DriverLocationData) => void) => {
    if (socketRef.current) {
      console.log('🗒️ Listening for driver location updates')
      socketRef.current.on('driver:location_update', callback)
      
      return () => {
        if (socketRef.current) {
          socketRef.current.off('driver:location_update', callback)
        }
      }
    }
    return () => {}
  }, [])

  const updateDriverLocation = useCallback((driverId: string, coordinates: { latitude: number, longitude: number }) => {
    if (socketRef.current && isConnected) {
      console.log('📍 Updating driver location:', { driverId, coordinates })
      socketRef.current.emit('driver:update_location', { driverId, coordinates })
    }
  }, [isConnected])

  return {
    socket: socketRef.current,
    isConnected,
    connectionError,
    joinAsDriver,
    joinAsRider,
    onNewRide,
    onNotificationSound,
    onRideStatusUpdate,
    onDriverLocationUpdate,
    updateDriverLocation
  }
}
