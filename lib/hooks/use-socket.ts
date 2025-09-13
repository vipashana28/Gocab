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
  const sseRef = useRef<EventSource | null>(null)
  const [usingSSE, setUsingSSE] = useState(false)

  useEffect(() => {
    // Initialize Socket.IO connection
    const initSocket = async () => {
      try {
        // First, initialize the Socket.IO server
        await fetch('/api/socket')
        
        // Then connect to it with Vercel-compatible settings
        const socket = io({
          path: '/api/socket',
          addTrailingSlash: false,
          transports: ['polling'], // Force polling for Vercel compatibility
          timeout: 20000,
          forceNew: true
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
          setConnectionError('Trying fallback...')
          setIsConnected(false)
          
          // Try SSE fallback
          console.log('🔄 Attempting SSE fallback...')
          // SSE fallback will be initialized by joinAsDriver/joinAsRider
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
      if (sseRef.current) {
        console.log('🧹 Cleaning up SSE connection')
        sseRef.current.close()
        sseRef.current = null
      }
    }
  }, [])

  const joinAsDriver = useCallback((driverId: string) => {
    if (socketRef.current && isConnected) {
      console.log('🚗 Joining as driver via WebSocket:', driverId)
      socketRef.current.emit('driver:join', driverId)
    } else {
      // SSE fallback
      console.log('📡 Joining as driver via SSE fallback:', driverId)
      const sse = new EventSource(`/api/notifications/sse?userId=${driverId}&userType=driver`)
      sseRef.current = sse
      setUsingSSE(true)
      
      sse.onopen = () => {
        console.log('📡 SSE connection established for driver')
        setIsConnected(true)
        setConnectionError(null)
      }
      
      sse.onerror = (error) => {
        console.error('❌ SSE connection error:', error)
        setConnectionError('Connection failed')
        setIsConnected(false)
      }
    }
  }, [isConnected])

  const joinAsRider = useCallback((riderId: string) => {
    if (socketRef.current && isConnected) {
      console.log('🧑‍🤝‍🧑 Joining as rider via WebSocket:', riderId)
      socketRef.current.emit('rider:join', riderId)
    } else {
      // SSE fallback
      console.log('📡 Joining as rider via SSE fallback:', riderId)
      const sse = new EventSource(`/api/notifications/sse?userId=${riderId}&userType=rider`)
      sseRef.current = sse
      setUsingSSE(true)
      
      sse.onopen = () => {
        console.log('📡 SSE connection established for rider')
        setIsConnected(true)
        setConnectionError(null)
      }
      
      sse.onerror = (error) => {
        console.error('❌ SSE connection error:', error)
        setConnectionError('Connection failed')
        setIsConnected(false)
      }
    }
  }, [isConnected])

  const onNewRide = useCallback((callback: (rideData: any) => void) => {
    if (socketRef.current) {
      console.log('🗒️ Listening for new rides via WebSocket')
      socketRef.current.on('ride:new', callback)
      
      return () => {
        if (socketRef.current) {
          socketRef.current.off('ride:new', callback)
        }
      }
    } else if (sseRef.current) {
      console.log('📡 Listening for new rides via SSE')
      const handleSSEMessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'ride:new') {
            callback(data.data)
          }
        } catch (error) {
          console.error('❌ Error parsing SSE message:', error)
        }
      }
      
      sseRef.current.addEventListener('message', handleSSEMessage)
      
      return () => {
        if (sseRef.current) {
          sseRef.current.removeEventListener('message', handleSSEMessage)
        }
      }
    }
    return () => {}
  }, [usingSSE])

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
