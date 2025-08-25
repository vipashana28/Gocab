'use client'

import { useEffect, useRef } from 'react'

interface MapViewProps {
  center: [number, number];
  zoom: number;
}

const MapView: React.FC<MapViewProps> = ({ center, zoom }) => {
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

            // Add tile layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(map)

            // Add marker at center
            L.marker(center)
              .addTo(map)
              .bindPopup('📍 Your Location')
              .openPopup()
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
  }, []) // Remove center, zoom from deps to prevent re-initialization

  // Update map view when center/zoom changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(center, zoom)
    }
  }, [center, zoom])

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