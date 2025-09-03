'use client'

import { useEffect, useRef } from 'react'

interface MapViewProps {
  center: [number, number]
  zoom: number
  markers?: {
    position: [number, number]
    popupText: string
    icon: 'pickup' | 'destination' | 'driver'
  }[]
}

const MapView = ({ center, zoom, markers = [] }: MapViewProps) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined' || !mapRef.current) return

    // Dynamic import of Leaflet to avoid SSR issues
    const initMap = async () => {
      try {
        const L = await import('leaflet')
        // CSS is imported via CDN in layout or handled by build system

        // Fix for default markers
        delete (L.Icon.Default.prototype as any)._getIconUrl
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        })

        // Create map only if it doesn't exist
        if (!mapInstanceRef.current && mapRef.current) {
          mapInstanceRef.current = L.map(mapRef.current).setView(center, zoom)

          // Add OpenStreetMap tiles
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          }).addTo(mapInstanceRef.current)
        }

        // Update map center and zoom
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView(center, zoom)
        }

      } catch (error) {
        console.error('Error loading Leaflet map:', error)
      }
    }

    initMap()

    // Cleanup on unmount
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [center, zoom])

  useEffect(() => {
    if (!mapInstanceRef.current || typeof window === 'undefined') return

    const L = require('leaflet')

    // Clear existing markers
    markersRef.current.forEach(marker => {
      mapInstanceRef.current?.removeLayer(marker)
    })
    markersRef.current = []

    // Add new markers
    markers.forEach(markerData => {
      // Create custom icons
      let iconHtml = ''
      let iconColor = ''
      
      switch (markerData.icon) {
        case 'pickup':
          iconHtml = '📍'
          iconColor = '#3b82f6' // blue
          break
        case 'destination':
          iconHtml = '🎯'
          iconColor = '#ef4444' // red
          break
        case 'driver':
          iconHtml = '🚗'
          iconColor = '#eab308' // yellow
          break
        default:
          iconHtml = '📌'
          iconColor = '#6b7280' // gray
      }

      const customIcon = L.divIcon({
        html: `<div style="background-color: ${iconColor}; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">${iconHtml}</div>`,
        className: 'custom-marker',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      })

      const marker = L.marker(markerData.position, { icon: customIcon })
        .addTo(mapInstanceRef.current)
        .bindPopup(markerData.popupText)

      markersRef.current.push(marker)
    })

  }, [markers])

  return (
    <div 
      ref={mapRef} 
      className="w-full h-full"
      style={{ minHeight: '400px' }}
    />
  )
}

export default MapView