'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Pusher from 'pusher-js'

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

export function usePusher() {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const pusherRef = useRef<Pusher | null>(null)
  const channelsRef = useRef<Map<string, any>>(new Map())

  useEffect(() => {
    // Initialize Pusher connection
    const initPusher = () => {
      try {
        console.log('🔔 Initializing Pusher connection...')
        
        const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
          cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
          forceTLS: true
        })
        
        pusherRef.current = pusher
        
        pusher.connection.bind('connected', () => {
          console.log('✅ Pusher connected:', pusher.connection.socket_id)
          setIsConnected(true)
          setConnectionError(null)
        })
        
        pusher.connection.bind('disconnected', () => {
          console.log('🔌 Pusher disconnected')
          setIsConnected(false)
        })
        
        pusher.connection.bind('error', (error: any) => {
          console.error('❌ Pusher connection error:', error)
          setConnectionError('Real-time service unavailable')
          setIsConnected(false)
        })
        
      } catch (error) {
        console.error('❌ Pusher initialization error:', error)
        setConnectionError('Real-time service unavailable')
        setIsConnected(false)
      }
    }

    initPusher()
    
    // Cleanup on unmount
    return () => {
      if (pusherRef.current) {
        console.log('🧹 Cleaning up Pusher connection')
        // Unsubscribe from all channels
        channelsRef.current.forEach((channel, channelName) => {
          pusherRef.current?.unsubscribe(channelName)
        })
        channelsRef.current.clear()
        pusherRef.current.disconnect()
        pusherRef.current = null
      }
    }
  }, [])

  const joinAsDriver = useCallback((driverId: string) => {
    if (!pusherRef.current || !isConnected) {
      console.log('⚠️ Pusher not connected, cannot join as driver')
      return
    }
    
    console.log('🚗 Joining as driver via Pusher:', driverId)
    
    const channelName = `driver-${driverId}`
    const channel = pusherRef.current.subscribe(channelName)
    channelsRef.current.set(channelName, channel)
    
    console.log(`✅ Driver subscribed to channel: ${channelName}`)
    
    // Update driver status to online via API
    fetch('/api/drivers/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId, isOnline: true })
    }).then(response => {
      if (response.ok) {
        console.log('✅ Driver status updated to online')
      } else {
        console.error('❌ Failed to update driver status:', response.status)
      }
    }).catch(error => {
      console.error('❌ Failed to update driver status:', error)
    })
    
  }, [isConnected])

  const joinAsRider = useCallback((riderId: string) => {
    if (!pusherRef.current || !isConnected) {
      console.log('⚠️ Pusher not connected, cannot join as rider')
      return
    }
    
    console.log('🧑‍🤝‍🧑 Joining as rider via Pusher:', riderId)
    
    const channelName = `rider-${riderId}`
    const channel = pusherRef.current.subscribe(channelName)
    channelsRef.current.set(channelName, channel)
    
  }, [isConnected])

  const onNewRide = useCallback((callback: (rideData: any) => void) => {
    console.log('🔔 Setting up onNewRide callback')
    
    // Store the callback to be used when driver channels are created
    const bindToDriverChannels = () => {
      const driverChannels = Array.from(channelsRef.current.entries())
        .filter(([channelName]) => channelName.startsWith('driver-'))
      
      console.log(`🔔 Binding ride:new to ${driverChannels.length} driver channels`)
      
      driverChannels.forEach(([channelName, channel]) => {
        console.log(`🔔 Binding ride:new to channel: ${channelName}`)
        channel.bind('ride:new', (data: any) => {
          console.log('🎉 Received ride:new event:', data)
          callback(data)
        })
      })
    }
    
    // Bind to existing channels
    bindToDriverChannels()
    
    // Store callback for future channels
    ;(callback as any)._bindToDriverChannels = bindToDriverChannels
    
    return () => {
      const driverChannels = Array.from(channelsRef.current.entries())
        .filter(([channelName]) => channelName.startsWith('driver-'))
      
      driverChannels.forEach(([, channel]) => {
        channel.unbind('ride:new', callback)
      })
    }
  }, [])

  const onNotificationSound = useCallback((callback: () => void) => {
    const driverChannels = Array.from(channelsRef.current.entries())
      .filter(([channelName]) => channelName.startsWith('driver-'))
    
    driverChannels.forEach(([, channel]) => {
      channel.bind('notification:sound', callback)
    })
    
    return () => {
      driverChannels.forEach(([, channel]) => {
        channel.unbind('notification:sound', callback)
      })
    }
  }, [])

  const onRideStatusUpdate = useCallback((callback: (data: RideStatusData) => void) => {
    const riderChannels = Array.from(channelsRef.current.entries())
      .filter(([channelName]) => channelName.startsWith('rider-'))
    
    riderChannels.forEach(([, channel]) => {
      channel.bind('ride:status_update', callback)
    })
    
    return () => {
      riderChannels.forEach(([, channel]) => {
        channel.unbind('ride:status_update', callback)
      })
    }
  }, [])

  const onDriverLocationUpdate = useCallback((callback: (data: DriverLocationData) => void) => {
    if (!pusherRef.current || !isConnected) return () => {}
    
    // Subscribe to global driver locations channel
    const channel = pusherRef.current.subscribe('driver-locations')
    channelsRef.current.set('driver-locations', channel)
    
    channel.bind('location:update', callback)
    
    return () => {
      channel.unbind('location:update', callback)
    }
  }, [isConnected])

  const updateDriverLocation = useCallback((driverId: string, coordinates: { latitude: number, longitude: number }) => {
    // Send location update via API (which will trigger Pusher broadcast)
    fetch('/api/drivers/location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId, coordinates })
    }).catch(error => {
      console.error('❌ Failed to update driver location:', error)
    })
  }, [])

  return {
    pusher: pusherRef.current,
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
