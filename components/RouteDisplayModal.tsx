'use client'

import { useEffect, useRef, useState } from 'react'

interface RouteDisplayModalProps {
  isOpen: boolean
  onClose: () => void
  pickup: {
    address: string
    coordinates: { latitude: number; longitude: number }
  }
  destination: {
    address: string
    coordinates: { latitude: number; longitude: number }
  }
  currentLocation?: { latitude: number; longitude: number }
}


export default function RouteDisplayModal({
  isOpen,
  onClose,
  pickup,
  destination,
  currentLocation
}: RouteDisplayModalProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<any>(null)
  const [directionsService, setDirectionsService] = useState<any>(null)
  const [directionsRenderer, setDirectionsRenderer] = useState<any>(null)
  const [routeInfo, setRouteInfo] = useState<{
    distance: string
    duration: string
    steps: any[]
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Initialize Google Maps
  useEffect(() => {
    if (!isOpen || !mapRef.current) return

    const initializeMap = () => {
      if (!(window as any).google) {
        console.error('Google Maps not loaded')
        return
      }

      // Create map centered between pickup and current location
      const center = currentLocation || pickup.coordinates
      if (!mapRef.current) return
      
      const mapInstance = new (window as any).google.maps.Map(mapRef.current, {
        zoom: 13,
        center: { lat: center.latitude, lng: center.longitude },
        mapId: 'gocabs-navigation-map',
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      })

      const directionsServiceInstance = new (window as any).google.maps.DirectionsService()
      const directionsRendererInstance = new (window as any).google.maps.DirectionsRenderer({
        suppressMarkers: false,
        polylineOptions: {
          strokeColor: '#10b981', // Green color
          strokeWeight: 5,
          strokeOpacity: 0.8
        }
      })

      directionsRendererInstance.setMap(mapInstance)

      setMap(mapInstance)
      setDirectionsService(directionsServiceInstance)
      setDirectionsRenderer(directionsRendererInstance)

      // Calculate and display route
      calculateRoute(directionsServiceInstance, directionsRendererInstance)
    }

    // Check if Google Maps is already loaded
    if ((window as any).google) {
      initializeMap()
    } else {
      // Wait for Google Maps to load
      const checkGoogleMaps = setInterval(() => {
        if ((window as any).google) {
          clearInterval(checkGoogleMaps)
          initializeMap()
        }
      }, 100)

      return () => clearInterval(checkGoogleMaps)
    }
  }, [isOpen, pickup, destination, currentLocation])

  const calculateRoute = (directionsServiceInstance: any, directionsRendererInstance: any) => {
    if (!directionsServiceInstance || !directionsRendererInstance) return

    setIsLoading(true)

    const origin = currentLocation 
      ? new (window as any).google.maps.LatLng(currentLocation.latitude, currentLocation.longitude)
      : new (window as any).google.maps.LatLng(pickup.coordinates.latitude, pickup.coordinates.longitude)
    
    const waypoints = currentLocation 
      ? [{ location: new (window as any).google.maps.LatLng(pickup.coordinates.latitude, pickup.coordinates.longitude), stopover: true }]
      : []
    
    const destinationLatLng = new (window as any).google.maps.LatLng(destination.coordinates.latitude, destination.coordinates.longitude)

    directionsServiceInstance.route(
      {
        origin: origin,
        destination: destinationLatLng,
        waypoints: waypoints,
        travelMode: (window as any).google.maps.TravelMode.DRIVING,
        optimizeWaypoints: true
      },
      (result: any, status: any) => {
        setIsLoading(false)
        
        if (status === 'OK') {
          directionsRendererInstance.setDirections(result)
          
          const route = result.routes[0]
          const leg = route.legs[0]
          
          setRouteInfo({
            distance: leg.distance.text,
            duration: leg.duration.text,
            steps: leg.steps
          })
          
          console.log('✅ Route calculated successfully')
        } else {
          console.error('❌ Directions request failed:', status)
          alert('Failed to calculate route. Please try again.')
        }
      }
    )
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full h-[80vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-4 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold">Navigation Route</h2>
              <p className="text-green-100 text-sm">Follow the route manually</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex">
          {/* Map */}
          <div className="flex-1 relative">
            <div ref={mapRef} className="w-full h-full" />
            
            {isLoading && (
              <div className="absolute inset-0 bg-white/90 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-200 border-t-green-600 mx-auto mb-4"></div>
                  <p className="text-gray-700 font-medium">Calculating route...</p>
                </div>
              </div>
            )}
          </div>

          {/* Route Info Sidebar */}
          <div className="w-80 bg-gray-50 border-l border-gray-200 p-4 overflow-y-auto">
            <div className="space-y-4">
              {/* Route Summary */}
              {routeInfo && (
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-3">Route Summary</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Distance:</span>
                      <span className="font-medium text-green-600">{routeInfo.distance}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Duration:</span>
                      <span className="font-medium text-blue-600">{routeInfo.duration}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Locations */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-3">Locations</h3>
                <div className="space-y-3">
                  {currentLocation && (
                    <div className="flex items-start space-x-3">
                      <div className="w-3 h-3 bg-blue-500 rounded-full mt-2"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Current Location</p>
                        <p className="text-xs text-gray-500">Your position</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full mt-2"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Pickup</p>
                      <p className="text-xs text-gray-500">{pickup.address}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-3 h-3 bg-red-500 rounded-full mt-2"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Destination</p>
                      <p className="text-xs text-gray-500">{destination.address}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Turn-by-turn directions */}
              {routeInfo && routeInfo.steps.length > 0 && (
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-3">Directions</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {routeInfo.steps.map((step: any, index: number) => (
                      <div key={index} className="flex items-start space-x-3 p-2 hover:bg-gray-50 rounded-lg">
                        <div className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p 
                            className="text-sm text-gray-900"
                            dangerouslySetInnerHTML={{ __html: step.instructions }}
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            {step.distance.text} • {step.duration.text}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 bg-white border border-gray-300 text-gray-700 py-3 px-4 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
            >
              Close Navigation
            </button>
            <button
              onClick={() => {
                if (pickup.coordinates) {
                  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${pickup.coordinates.latitude},${pickup.coordinates.longitude}&travelmode=driving`
                  window.open(mapsUrl, '_blank')
                }
              }}
              className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 px-4 rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg"
            >
              Open in Google Maps
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
