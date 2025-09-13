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
  const callbacksRef = useRef<{
    onNewRide?: (data: any) => void
    onNotificationSound?: () => void
    onRideStatusUpdate?: (data: any) => void
    onDriverLocationUpdate?: (data: any) => void
  }>({})

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
    
    // Bind existing callbacks to the new channel
    if (callbacksRef.current.onNewRide) {
      console.log('🔔 Binding onNewRide to driver channel')
      channel.bind('ride:new', (data: any) => {
        console.log('🎉 Driver received ride:new event:', data)
        callbacksRef.current.onNewRide?.(data)
      })
    }
    
    if (callbacksRef.current.onNotificationSound) {
      console.log('🔔 Binding onNotificationSound to driver channel')
      channel.bind('notification:sound', () => {
        console.log('🔊 Driver received notification sound')
        callbacksRef.current.onNotificationSound?.()
      })
    }
    
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
    
    console.log(`✅ Rider subscribed to channel: ${channelName}`)
    
    // Bind existing callbacks to the new channel
    if (callbacksRef.current.onRideStatusUpdate) {
      console.log('🔔 Binding onRideStatusUpdate to rider channel')
      channel.bind('ride:status_update', (data: any) => {
        console.log('📱 Rider received ride:status_update event:', data)
        callbacksRef.current.onRideStatusUpdate?.(data)
      })
    }
    
  }, [isConnected])

  const onNewRide = useCallback((callback: (rideData: any) => void) => {
    console.log('🔔 Setting up onNewRide callback')
    callbacksRef.current.onNewRide = callback
    
    // Bind to existing driver channels
    const driverChannels = Array.from(channelsRef.current.entries())
      .filter(([channelName]) => channelName.startsWith('driver-'))
    
    driverChannels.forEach(([channelName, channel]) => {
      console.log(`🔔 Binding ride:new to existing channel: ${channelName}`)
      channel.bind('ride:new', (data: any) => {
        console.log('🎉 Received ride:new event:', data)
        callback(data)
      })
    })
    
    return () => {
      callbacksRef.current.onNewRide = undefined
      driverChannels.forEach(([, channel]) => {
        channel.unbind('ride:new', callback)
      })
    }
  }, [])

  const onNotificationSound = useCallback((callback: () => void) => {
    console.log('🔔 Setting up onNotificationSound callback')
    callbacksRef.current.onNotificationSound = callback
    
    // Bind to existing driver channels
    const driverChannels = Array.from(channelsRef.current.entries())
      .filter(([channelName]) => channelName.startsWith('driver-'))
    
    driverChannels.forEach(([channelName, channel]) => {
      console.log(`🔔 Binding notification:sound to existing channel: ${channelName}`)
      channel.bind('notification:sound', () => {
        console.log('🔊 Received notification sound')
        callback()
      })
    })
    
    return () => {
      callbacksRef.current.onNotificationSound = undefined
      driverChannels.forEach(([, channel]) => {
        channel.unbind('notification:sound', callback)
      })
    }
  }, [])

  const onRideStatusUpdate = useCallback((callback: (data: RideStatusData) => void) => {
    console.log('🔔 Setting up onRideStatusUpdate callback')
    callbacksRef.current.onRideStatusUpdate = callback
    
    // Bind to existing rider channels
    const riderChannels = Array.from(channelsRef.current.entries())
      .filter(([channelName]) => channelName.startsWith('rider-'))
    
    riderChannels.forEach(([channelName, channel]) => {
      console.log(`🔔 Binding ride:status_update to existing channel: ${channelName}`)
      channel.bind('ride:status_update', (data: any) => {
        console.log('📱 Received ride:status_update event:', data)
        callback(data)
      })
    })
    
    return () => {
      callbacksRef.current.onRideStatusUpdate = undefined
      riderChannels.forEach(([, channel]) => {
        channel.unbind('ride:status_update', callback)
      })
    }
  }, [])

  const onDriverLocationUpdate = useCallback((callback: (data: DriverLocationData) => void) => {
    console.log('🔔 Setting up onDriverLocationUpdate callback')
    callbacksRef.current.onDriverLocationUpdate = callback
    
    if (!pusherRef.current || !isConnected) return () => {}
    
    // Subscribe to global driver locations channel
    const channelName = 'driver-locations'
    let channel = channelsRef.current.get(channelName)
    
    if (!channel) {
      channel = pusherRef.current.subscribe(channelName)
      channelsRef.current.set(channelName, channel)
      console.log(`✅ Subscribed to global channel: ${channelName}`)
    }
    
    channel.bind('location:update', (data: any) => {
      console.log('📍 Received location:update event:', data)
      callback(data)
    })
    
    return () => {
      callbacksRef.current.onDriverLocationUpdate = undefined
      channel.unbind('location:update', callback)
    }
  }, [isConnected])

  const updateDriverLocation = useCallback((driverId: string, coordinates: { latitude: number, longitude: number }) => {
    console.log('📍 Updating driver location via API:', coordinates)
    
    // Send location update via API (which will trigger Pusher broadcast)
    fetch('/api/drivers/location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId, location: coordinates })
    }).then(response => {
      if (response.ok) {
        console.log('✅ Driver location updated successfully')
      } else {
        console.error('❌ Failed to update driver location:', response.status)
      }
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
