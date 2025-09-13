'use client'

import { useState, useEffect, useCallback } from 'react'

interface GPSPosition {
  latitude: number
  longitude: number
  accuracy: number
  heading?: number
  speed?: number
  timestamp: number
}

interface GPSTrackingOptions {
  enableHighAccuracy?: boolean
  timeout?: number
  maximumAge?: number
  updateInterval?: number
}

interface GPSTrackingHook {
  position: GPSPosition | null
  error: string | null
  isTracking: boolean
  accuracy: number | null
  startTracking: () => void
  stopTracking: () => void
  requestPermission: () => Promise<boolean>
  isSupported: boolean
}

export function useGPSTracking(options: GPSTrackingOptions = {}): GPSTrackingHook {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 5000,
    updateInterval = 5000
  } = options

  const [position, setPosition] = useState<GPSPosition | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isTracking, setIsTracking] = useState(false)
  const [watchId, setWatchId] = useState<number | null>(null)
  const [isSupported, setIsSupported] = useState(false)

  // Check if geolocation is supported
  useEffect(() => {
    setIsSupported('geolocation' in navigator)
  }, [])

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError('Geolocation is not supported by this browser')
      return false
    }

    try {
      // Check current permission status
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'geolocation' })
        
        if (permission.state === 'denied') {
          setError('Location permission denied. Please enable location access in your browser settings.')
          return false
        }
      }

      // Test geolocation access
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            console.log('✅ GPS permission granted')
            setError(null)
            resolve(true)
          },
          (error) => {
            console.error('❌ GPS permission error:', error)
            let errorMessage = 'Failed to get location permission'
            
            switch (error.code) {
              case error.PERMISSION_DENIED:
                errorMessage = 'Location permission denied. Please enable location access.'
                break
              case error.POSITION_UNAVAILABLE:
                errorMessage = 'Location information unavailable. Please check your GPS settings.'
                break
              case error.TIMEOUT:
                errorMessage = 'Location request timed out. Please try again.'
                break
            }
            
            setError(errorMessage)
            resolve(false)
          },
          {
            enableHighAccuracy,
            timeout: 5000,
            maximumAge: 0
          }
        )
      })
    } catch (err) {
      console.error('❌ Permission request failed:', err)
      setError('Failed to request location permission')
      return false
    }
  }, [isSupported, enableHighAccuracy])

  const startTracking = useCallback(async () => {
    if (!isSupported) {
      setError('Geolocation is not supported')
      return
    }

    if (isTracking) {
      console.log('📍 GPS tracking already active')
      return
    }

    console.log('📍 Starting GPS tracking...')
    setIsTracking(true)
    setError(null)

    const watchOptions: PositionOptions = {
      enableHighAccuracy,
      timeout,
      maximumAge
    }

    const handleSuccess = (pos: GeolocationPosition) => {
      const newPosition: GPSPosition = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        heading: pos.coords.heading || undefined,
        speed: pos.coords.speed || undefined,
        timestamp: pos.timestamp
      }

      setPosition(newPosition)
      setError(null)
      
      console.log('📍 GPS position updated:', {
        lat: newPosition.latitude.toFixed(6),
        lng: newPosition.longitude.toFixed(6),
        accuracy: `${newPosition.accuracy.toFixed(0)}m`
      })
    }

    const handleError = (error: GeolocationPositionError) => {
      console.error('❌ GPS tracking error:', error)
      
      let errorMessage = 'GPS tracking failed'
      
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'Location permission denied'
          setIsTracking(false)
          break
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'Location unavailable'
          break
        case error.TIMEOUT:
          errorMessage = 'Location request timed out'
          break
      }
      
      setError(errorMessage)
    }

    try {
      const id = navigator.geolocation.watchPosition(
        handleSuccess,
        handleError,
        watchOptions
      )
      
      setWatchId(id)
      console.log('✅ GPS tracking started with watch ID:', id)
    } catch (err) {
      console.error('❌ Failed to start GPS tracking:', err)
      setError('Failed to start location tracking')
      setIsTracking(false)
    }
  }, [isSupported, isTracking, enableHighAccuracy, timeout, maximumAge])

  const stopTracking = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId)
      setWatchId(null)
      console.log('🛑 GPS tracking stopped')
    }
    
    setIsTracking(false)
  }, [watchId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [watchId])

  // Auto-restart tracking if it stops unexpectedly
  useEffect(() => {
    if (isTracking && watchId === null) {
      console.log('🔄 Restarting GPS tracking...')
      startTracking()
    }
  }, [isTracking, watchId, startTracking])

  return {
    position,
    error,
    isTracking,
    accuracy: position?.accuracy || null,
    startTracking,
    stopTracking,
    requestPermission,
    isSupported
  }
}
