'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { loadGoogleMaps, isGoogleMapsLoaded, getGoogleMaps } from '@/lib/googleMapsLoader'

// Extend the global Window interface to include google
declare global {
  interface Window {
    google: typeof google
  }
}

interface MapViewProps {
  center: [number, number]
  zoom: number
  markers?: {
    position: [number, number]
    popupText: string
    icon: 'pickup' | 'destination' | 'driver'
  }[]
  routes?: {
    origin: [number, number]
    destination: [number, number]
    waypoints?: [number, number][]
  }[]
  polylineRoute?: {
    polyline: string
    color?: string
    weight?: number
    opacity?: number
  }
  fitBounds?: boolean
}

const MapView = ({ center, zoom, markers = [], routes = [], polylineRoute, fitBounds = false }: MapViewProps) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<any[]>([])
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null)
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null)
  const polylineRef = useRef<google.maps.Polyline | null>(null)
  const initializingRef = useRef(false)
  const mountedRef = useRef(true)
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check DOM element availability first
  useLayoutEffect(() => {
    console.log('🔍 useLayoutEffect - DOM Check:', {
      mapRefCurrent: !!mapRef.current,
      mapRefElement: mapRef.current,
      clientWidth: mapRef.current?.clientWidth,
      clientHeight: mapRef.current?.clientHeight
    })
  }, [])

  // Initialize Google Maps using singleton loader
  useEffect(() => {
    const initMap = async () => {
      if (initializingRef.current || mapInstanceRef.current) {
        console.log('🗺️ Map already initializing or initialized, skipping...')
        return
      }

      initializingRef.current = true
      
      const createMap = (retryCount = 0) => {
        if (mapInstanceRef.current) {
          console.log('🗺️ Map instance already exists, skipping creation')
          setIsLoaded(true)
          initializingRef.current = false
          return
        }

        if (!mapRef.current) {
          console.warn(`🗺️ Map container not found (attempt ${retryCount + 1})`)
          
          if (retryCount < 5) {
            const delay = 300 + (retryCount * 200)
            console.log(`🗺️ Retrying map creation in ${delay}ms...`)
            setTimeout(() => createMap(retryCount + 1), delay)
            return
          } else {
            console.error('🗺️ Map container not found after 5 attempts')
            initializingRef.current = false
            if (mountedRef.current) {
              setError('Failed to initialize map container. Please refresh the page.')
            }
            return
          }
        }

        if (mapRef.current.clientWidth === 0 || mapRef.current.clientHeight === 0) {
          console.warn(`🗺️ Map container has no dimensions: ${mapRef.current.clientWidth}x${mapRef.current.clientHeight}`)
          
          if (retryCount < 5) {
            const delay = 300 + (retryCount * 200)
            console.log(`🗺️ Retrying for proper dimensions in ${delay}ms...`)
            setTimeout(() => createMap(retryCount + 1), delay)
            return
          } else {
            console.error('🗺️ Map container has no dimensions after 5 attempts')
            initializingRef.current = false
            if (mountedRef.current) {
              setError('Map container has no dimensions. Please check CSS styling.')
            }
            return
          }
        }

        console.log('🗺️ Creating Google Maps instance...')
        
        mapInstanceRef.current = new google.maps.Map(mapRef.current, {
          center: { lat: center[0], lng: center[1] },
          zoom,
          mapId: 'gocabs-map', // Required for Advanced Markers
          mapTypeId: google.maps.MapTypeId.ROADMAP,
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }]
            }
          ],
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          scaleControl: true,
          streetViewControl: false,
          rotateControl: false,
          fullscreenControl: true
        })

        directionsServiceRef.current = new google.maps.DirectionsService()
        directionsRendererRef.current = new google.maps.DirectionsRenderer({
          suppressMarkers: false,
          polylineOptions: {
            strokeColor: '#3b82f6',
            strokeWeight: 4,
            strokeOpacity: 0.8
          }
        })
        directionsRendererRef.current.setMap(mapInstanceRef.current)

        console.log('✅ Google Maps created successfully')
        initializingRef.current = false
        
        if (mountedRef.current) {
          setIsLoaded(true)
          setError(null)
        }
      }

      try {
        // Check if Google Maps is already loaded
        if (isGoogleMapsLoaded()) {
          console.log('🗺️ Google Maps already loaded, creating map...')
          setTimeout(() => createMap(), 100)
          return
        }

        // Load Google Maps using singleton loader
        console.log('🗺️ Loading Google Maps via singleton loader...')
        await loadGoogleMaps()
        console.log('✅ Google Maps loaded successfully via singleton')
        
        setTimeout(() => createMap(), 100)

      } catch (err) {
        console.error('❌ Failed to load Google Maps:', err)
        initializingRef.current = false
        if (mountedRef.current) {
          setError('Failed to load Google Maps. Please check your internet connection and API key.')
        }
      }
    }

    // Wait for DOM element to be available
    if (!mapRef.current) {
      console.log('🗺️ DOM element not ready yet, waiting...')
      const checkDOM = () => {
        if (mapRef.current && mountedRef.current) {
          console.log('🗺️ DOM element now available, initializing map...')
          initMap()
        } else if (mountedRef.current) {
          setTimeout(checkDOM, 100)
        }
      }
      setTimeout(checkDOM, 100)
      return
    }

    initMap()
  }, [center, zoom])

  // Complete cleanup prevention to avoid removeChild errors
  useEffect(() => {
    return () => {
      mountedRef.current = false
      initializingRef.current = false
      
      // Aggressive approach: don't touch DOM at all during cleanup
      // Just clear references and let garbage collection handle it
      try {
        // Clear all Google Maps objects without DOM manipulation
        if (markersRef.current?.length > 0) {
          markersRef.current.forEach(marker => {
            try {
              if (marker && marker.setMap) {
                marker.setMap(null)
              }
            } catch (e) {
              // Ignore DOM errors during cleanup
            }
          })
        }
        
        // Clear other Google Maps objects
        if (directionsRendererRef.current?.setMap) {
          try {
            directionsRendererRef.current.setMap(null)
          } catch (e) {
            // Ignore DOM errors during cleanup
          }
        }
        
        if (polylineRef.current?.setMap) {
          try {
            polylineRef.current.setMap(null)
          } catch (e) {
            // Ignore DOM errors during cleanup
          }
        }
      } catch (e) {
        // Ignore all cleanup errors
        console.warn('Map cleanup warning (safe to ignore):', e instanceof Error ? e.message : 'Unknown error')
      }
      
      // Clear all refs
      markersRef.current = []
      directionsRendererRef.current = null
      polylineRef.current = null
      directionsServiceRef.current = null
      mapInstanceRef.current = null
    }
  }, [])

  // Update map center and zoom
  useEffect(() => {
    if (mapInstanceRef.current && isLoaded) {
      mapInstanceRef.current.setCenter({ lat: center[0], lng: center[1] })
      mapInstanceRef.current.setZoom(zoom)
    }
  }, [center, zoom, isLoaded])

  // Update markers using modern AdvancedMarkerElement
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded || !mountedRef.current) return

    // Clear existing markers
    markersRef.current.forEach((marker: any) => {
      if (mountedRef.current && marker.setMap) {
        marker.setMap(null)
      }
    })
    markersRef.current = []

    markers.forEach((markerData) => {
      let iconUrl = ''
      let iconSize = { width: 32, height: 32 }
      
      switch (markerData.icon) {
        case 'pickup':
          iconUrl = '/icons/pickup-pin.svg'
          break
        case 'destination':
          iconUrl = '/icons/destination-pin.svg'
          break
        case 'driver':
          iconUrl = '/icons/car-pin.svg'
          iconSize = { width: 40, height: 40 }
          break
        default:
          iconUrl = '/icons/pickup-pin.svg'
      }

      try {
        // Try to use AdvancedMarkerElement if available (newer API)
        if (google.maps.marker?.AdvancedMarkerElement) {
          // Create custom icon element
          const iconElement = document.createElement('img')
          iconElement.src = iconUrl
          iconElement.style.width = `${iconSize.width}px`
          iconElement.style.height = `${iconSize.height}px`
          iconElement.alt = markerData.popupText

          const marker = new google.maps.marker.AdvancedMarkerElement({
            map: mapInstanceRef.current,
            position: { lat: markerData.position[0], lng: markerData.position[1] },
            content: iconElement,
            title: markerData.popupText
          })

          // Add click listener for info window
          const infoWindow = new google.maps.InfoWindow({
            content: markerData.popupText
          })

          marker.addListener('click', () => {
            infoWindow.open(mapInstanceRef.current, marker)
          })

          markersRef.current.push(marker)
        } else {
          // Fallback to legacy Marker for older API versions
          const marker = new google.maps.Marker({
            position: { lat: markerData.position[0], lng: markerData.position[1] },
            map: mapInstanceRef.current,
            title: markerData.popupText,
            icon: {
              url: iconUrl,
              scaledSize: new google.maps.Size(iconSize.width, iconSize.height),
              anchor: new google.maps.Point(iconSize.width / 2, iconSize.height)
            }
          })

          const infoWindow = new google.maps.InfoWindow({
            content: markerData.popupText
          })

          marker.addListener('click', () => {
            infoWindow.open(mapInstanceRef.current, marker)
          })

          markersRef.current.push(marker)
        }
      } catch (error) {
        console.warn('Failed to create marker:', error)
        // Fallback to basic marker without custom icon
        const marker = new google.maps.Marker({
          position: { lat: markerData.position[0], lng: markerData.position[1] },
          map: mapInstanceRef.current,
          title: markerData.popupText
        })
        markersRef.current.push(marker)
      }
    })
  }, [markers, isLoaded])

  // Update routes
  useEffect(() => {
    if (!mapInstanceRef.current || !directionsServiceRef.current || !directionsRendererRef.current || !isLoaded || !mountedRef.current) return

    if (routes.length === 0) {
      if (directionsRendererRef.current && mountedRef.current) {
        directionsRendererRef.current.setDirections({ routes: [] } as any)
      }
      return
    }

    const route = routes[0]
    if (!route) return

    const request: google.maps.DirectionsRequest = {
      origin: { lat: route.origin[0], lng: route.origin[1] },
      destination: { lat: route.destination[0], lng: route.destination[1] },
      travelMode: google.maps.TravelMode.DRIVING,
      optimizeWaypoints: true,
      avoidHighways: false,
      avoidTolls: false
    }

    if (route.waypoints && route.waypoints.length > 0) {
      request.waypoints = route.waypoints.map((point: [number, number]) => ({
        location: { lat: point[0], lng: point[1] },
        stopover: true
      }))
    }

    directionsServiceRef.current.route(request, (result: google.maps.DirectionsResult | null, status: google.maps.DirectionsStatus) => {
      if (status === google.maps.DirectionsStatus.OK && result) {
        directionsRendererRef.current?.setDirections(result)
      } else {
        console.error('Directions request failed:', status)
      }
    })
  }, [routes, isLoaded])

  // Handle polyline route (for custom route visualization)
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded || !mountedRef.current) return

    // Clear existing polyline
    if (polylineRef.current && mountedRef.current) {
      polylineRef.current.setMap(null)
      polylineRef.current = null
    }

    if (!polylineRoute || !polylineRoute.polyline) return

    try {
      // Decode polyline
      const decodedPath = google.maps.geometry.encoding.decodePath(polylineRoute.polyline)
      
      // Create polyline
      polylineRef.current = new google.maps.Polyline({
        path: decodedPath,
        geodesic: true,
        strokeColor: polylineRoute.color || '#1976D2',
        strokeOpacity: polylineRoute.opacity || 0.8,
        strokeWeight: polylineRoute.weight || 4
      })

      polylineRef.current.setMap(mapInstanceRef.current)

      // Fit bounds to show entire route if requested
      if (fitBounds && decodedPath.length > 0) {
        const bounds = new google.maps.LatLngBounds()
        decodedPath.forEach(point => bounds.extend(point))
        
        // Also include markers in bounds
        markers.forEach(marker => {
          bounds.extend(new google.maps.LatLng(marker.position[0], marker.position[1]))
        })
        
        mapInstanceRef.current.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 })
      }

    } catch (error) {
      console.error('Error rendering polyline:', error)
    }
  }, [polylineRoute, fitBounds, markers, isLoaded])

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg">
        <div className="text-center p-4">
          <div className="text-red-500 text-lg font-semibold mb-2">Map Error</div>
          <div className="text-gray-600 text-sm">{error}</div>
          <div className="text-xs text-gray-500 mt-2">
            Please check your Google Maps API configuration
          </div>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="w-full h-full"
      style={{ 
        minHeight: '400px',
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: '#f0f0f0'
      }}
    >
      {/* Isolated container for Google Maps - React won't touch this */}
      <div
        ref={mapRef}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 1
        }}
        suppressHydrationWarning
      />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 2 }}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <div className="text-gray-600">Loading Google Maps...</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MapView