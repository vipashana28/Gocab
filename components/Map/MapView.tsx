'use client'

import { useEffect, useRef } from 'react'

interface MapViewProps {
  center: [number, number];
  zoom: number;
  pickupLocation?: { latitude: number; longitude: number; address?: string };
  dropLocation?: { latitude: number; longitude: number; address?: string };
  driverLocation?: { latitude: number; longitude: number };
  showRoute?: boolean;
}

const MapView: React.FC<MapViewProps> = ({ 
  center, 
  zoom, 
  pickupLocation, 
  dropLocation, 
  driverLocation, 
  showRoute = false 
}) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)

  useEffect(() => {
    let isMounted = true

    if (typeof window !== 'undefined' && mapRef.current && !mapInstanceRef.current) {
      const mapElement = mapRef.current
      
      // Clear any existing Leaflet container
      mapElement.innerHTML = ''
      ;(mapElement as any)._leaflet_id = null // Clear Leaflet's internal reference
      
      // Dynamic import to avoid SSR issues
      import('leaflet').then((L) => {
        if (!isMounted) return // Don't proceed if component unmounted
        
        // Inject Leaflet CSS only once
        if (!document.querySelector('link[href*="leaflet.css"]')) {
          const link = document.createElement('link')
          link.rel = 'stylesheet'
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
          document.head.appendChild(link)
        }

        // Add custom CSS to override Leaflet's z-indexes
        if (!document.querySelector('#leaflet-z-index-override')) {
          const style = document.createElement('style')
          style.id = 'leaflet-z-index-override'
          style.textContent = `
            .leaflet-container {
              z-index: 1 !important;
            }
            .leaflet-control-container {
              z-index: 2 !important;
            }
            .leaflet-pane {
              z-index: 1 !important;
            }
            .leaflet-popup {
              z-index: 3 !important;
            }
            .leaflet-tooltip {
              z-index: 3 !important;
            }
          `
          document.head.appendChild(style)
        }
        
        // Fix for default markers
        delete (L.Icon.Default.prototype as any)._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        })

        try {
          // Create map only if not already created and element is still mounted
          if (!mapInstanceRef.current && isMounted) {
            const map = L.map(mapElement).setView(center, zoom)
            mapInstanceRef.current = map

            // Add standard OpenStreetMap tile layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(map)

            // Create custom icons
            const createCustomIcon = (color: string, emoji: string, size: number = 40) => {
              return L.divIcon({
                className: 'custom-marker',
                html: `
                  <div style="
                    width: ${size}px;
                    height: ${size}px;
                    background: ${color};
                    border: 3px solid white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: ${size * 0.4}px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    animation: markerPulse 2s infinite;
                  ">
                    ${emoji}
                  </div>
                  <style>
                    @keyframes markerPulse {
                      0%, 100% { transform: scale(1); }
                      50% { transform: scale(1.1); }
                    }
                  </style>
                `,
                iconSize: [size, size],
                iconAnchor: [size/2, size/2]
              })
            }

            // Add user location marker (default green)
            const userIcon = createCustomIcon('linear-gradient(135deg, #22c55e, #16a34a)', '👤', 35)
            L.marker(center, { icon: userIcon })
              .addTo(map)
              .bindPopup(`
                <div style="text-align: center; font-family: Inter, sans-serif;">
                  <strong style="color: #16a34a;">📍 Your Location</strong><br>
                  <small style="color: #6b7280;">Current position</small>
                </div>
              `)

            // Add pickup location marker (blue)
            if (pickupLocation) {
              const pickupIcon = createCustomIcon('linear-gradient(135deg, #3b82f6, #1d4ed8)', '🚗', 45)
              L.marker([pickupLocation.latitude, pickupLocation.longitude], { icon: pickupIcon })
                .addTo(map)
                .bindPopup(`
                  <div style="text-align: center; font-family: Inter, sans-serif;">
                    <strong style="color: #1d4ed8;">🚗 Pickup Point</strong><br>
                    <small style="color: #6b7280;">${pickupLocation.address || 'Pickup location'}</small>
                  </div>
                `)
            }

            // Add drop location marker (red)
            if (dropLocation) {
              const dropIcon = createCustomIcon('linear-gradient(135deg, #ef4444, #dc2626)', '🎯', 45)
              L.marker([dropLocation.latitude, dropLocation.longitude], { icon: dropIcon })
                .addTo(map)
                .bindPopup(`
                  <div style="text-align: center; font-family: Inter, sans-serif;">
                    <strong style="color: #dc2626;">🎯 Destination</strong><br>
                    <small style="color: #6b7280;">${dropLocation.address || 'Drop location'}</small>
                  </div>
                `)
            }

            // Add driver location marker (golden)
            if (driverLocation) {
              const driverIcon = createCustomIcon('linear-gradient(135deg, #eab308, #ca8a04)', '🚙', 40)
              L.marker([driverLocation.latitude, driverLocation.longitude], { icon: driverIcon })
                .addTo(map)
                .bindPopup(`
                  <div style="text-align: center; font-family: Inter, sans-serif;">
                    <strong style="color: #ca8a04;">🚙 Your Driver</strong><br>
                    <small style="color: #6b7280;">Live location</small>
                  </div>
                `)
            }

            // Add route line if both pickup and drop locations exist
            if (showRoute && pickupLocation && dropLocation) {
              const routeLine = L.polyline([
                [pickupLocation.latitude, pickupLocation.longitude],
                [dropLocation.latitude, dropLocation.longitude]
              ], {
                color: '#22c55e',
                weight: 4,
                opacity: 0.8,
                dashArray: '10, 5'
              }).addTo(map)

              // Fit map to show the route
              map.fitBounds(routeLine.getBounds(), { padding: [50, 50] })
            }
          }
        } catch (error) {
          console.error('Error creating map:', error)
        }
      })
    }

    // Cleanup function
    return () => {
      isMounted = false
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove()
        } catch (e) {
          console.log('Map cleanup error:', e)
        }
        mapInstanceRef.current = null
      }
    }
  }, []) // Remove all deps to prevent re-initialization

  // Update map view and markers when props change
  useEffect(() => {
    if (mapInstanceRef.current) {
      // Update center and zoom
      mapInstanceRef.current.setView(center, zoom)
      
      // Clear existing markers
      mapInstanceRef.current.eachLayer((layer: any) => {
        if (layer instanceof (window as any).L.Marker) {
          mapInstanceRef.current.removeLayer(layer)
        }
      })
      
      // Re-add markers based on current props
      import('leaflet').then((L) => {
        if (!mapInstanceRef.current) return
        
        const createCustomIcon = (color: string, emoji: string, size: number = 40) => {
          return L.divIcon({
            className: 'custom-marker',
            html: `
              <div style="
                width: ${size}px;
                height: ${size}px;
                background: ${color};
                border: 3px solid white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: ${size * 0.4}px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                animation: markerPulse 2s infinite;
              ">
                ${emoji}
              </div>
            `,
            iconSize: [size, size],
            iconAnchor: [size/2, size/2]
          })
        }

        // Re-add user location
        const userIcon = createCustomIcon('linear-gradient(135deg, #22c55e, #16a34a)', '👤', 35)
        L.marker(center, { icon: userIcon }).addTo(mapInstanceRef.current)

        // Re-add pickup marker
        if (pickupLocation) {
          const pickupIcon = createCustomIcon('linear-gradient(135deg, #3b82f6, #1d4ed8)', '🚗', 45)
          L.marker([pickupLocation.latitude, pickupLocation.longitude], { icon: pickupIcon })
            .addTo(mapInstanceRef.current)
        }

        // Re-add drop marker
        if (dropLocation) {
          const dropIcon = createCustomIcon('linear-gradient(135deg, #ef4444, #dc2626)', '🎯', 45)
          L.marker([dropLocation.latitude, dropLocation.longitude], { icon: dropIcon })
            .addTo(mapInstanceRef.current)
        }

        // Re-add driver marker
        if (driverLocation) {
          const driverIcon = createCustomIcon('linear-gradient(135deg, #eab308, #ca8a04)', '🚙', 40)
          L.marker([driverLocation.latitude, driverLocation.longitude], { icon: driverIcon })
            .addTo(mapInstanceRef.current)
        }

        // Re-add route
        if (showRoute && pickupLocation && dropLocation) {
          const routeLine = L.polyline([
            [pickupLocation.latitude, pickupLocation.longitude],
            [dropLocation.latitude, dropLocation.longitude]
          ], {
            color: '#22c55e',
            weight: 4,
            opacity: 0.8,
            dashArray: '10, 5'
          }).addTo(mapInstanceRef.current)
          
          mapInstanceRef.current.fitBounds(routeLine.getBounds(), { padding: [50, 50] })
        }
      })
    }
  }, [center, zoom, pickupLocation, dropLocation, driverLocation, showRoute])

  return (
    <div 
      ref={mapRef} 
      style={{ 
        height: '100%', 
        width: '100%', 
        backgroundColor: '#f0f0f0',
        borderRadius: '8px',
        position: 'relative',
        zIndex: 1
      }}
    />
  )
}

export default MapView