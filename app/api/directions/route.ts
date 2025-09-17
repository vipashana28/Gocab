import { NextRequest, NextResponse } from 'next/server'

interface DirectionsRequest {
  origin: {
    latitude: number
    longitude: number
  }
  destination: {
    latitude: number
    longitude: number
  }
  waypoints?: {
    latitude: number
    longitude: number
  }[]
  travelMode?: 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT'
  avoidHighways?: boolean
  avoidTolls?: boolean
  optimizeWaypoints?: boolean
}

interface FareEstimate {
  baseFare: number
  distanceFare: number
  timeFare: number
  surgeFare: number
  platformFee: number
  totalFare: number
  currency: string
  breakdown: {
    baseRate: number
    perKmRate: number
    perMinuteRate: number
    surgeMultiplier: number
    platformFeePercentage: number
    distance: number
    duration: number
  }
}

// Singapore Dollar (SGD) fare calculation logic
function calculateFare(distanceKm: number, durationMinutes: number, surgeMultiplier: number = 1.0): FareEstimate {
  // Singapore rates as specified
  const BASE_FARE = 3.50          // SGD 3.50
  const PER_KM_RATE = 0.70        // SGD 0.70 per kilometer
  const PER_MINUTE_RATE = 0.25    // SGD 0.25 per minute
  const PLATFORM_FEE_PERCENTAGE = 0.05  // 5% platform fee
  const MIN_FARE = 4.00           // Minimum fare SGD 4.00

  const baseFare = BASE_FARE
  const distanceFare = distanceKm * PER_KM_RATE
  const timeFare = durationMinutes * PER_MINUTE_RATE
  
  // Calculate subtotal before platform fee
  const subtotal = baseFare + distanceFare + timeFare
  const surgeFare = subtotal * (surgeMultiplier - 1)
  const subtotalWithSurge = subtotal + surgeFare
  
  // Apply platform fee (5% of subtotal + surge)
  const platformFee = subtotalWithSurge * PLATFORM_FEE_PERCENTAGE
  const totalFare = Math.max(subtotalWithSurge + platformFee, MIN_FARE)

  return {
    baseFare,
    distanceFare,
    timeFare,
    surgeFare,
    platformFee,
    totalFare: Math.round(totalFare * 100) / 100, // Round to 2 decimal places
    currency: 'SGD',
    breakdown: {
      baseRate: BASE_FARE,
      perKmRate: PER_KM_RATE,
      perMinuteRate: PER_MINUTE_RATE,
      surgeMultiplier,
      platformFeePercentage: PLATFORM_FEE_PERCENTAGE,
      distance: Math.round(distanceKm * 100) / 100,
      duration: Math.round(durationMinutes * 100) / 100
    }
  }
}

// Simple in-memory cache to prevent duplicate requests
const requestCache = new Map<string, { result: any, timestamp: number }>()
const CACHE_DURATION = 5000 // 5 seconds

export async function POST(request: NextRequest) {
  try {
    const body: DirectionsRequest = await request.json()
    
    // Create a cache key from the request
    const cacheKey = `${body.origin.latitude},${body.origin.longitude}-${body.destination.latitude},${body.destination.longitude}-${body.travelMode}`
    
    // Check cache first
    const cached = requestCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log('📍 Returning cached result for:', cacheKey)
      return NextResponse.json(cached.result)
    }
    
    console.log('📍 Directions API Request:', JSON.stringify(body, null, 2))
    const { 
      origin, 
      destination, 
      waypoints = [], 
      travelMode = 'DRIVING',
      avoidHighways = false,
      avoidTolls = false,
      optimizeWaypoints = true
    } = body

    // Validate input
    if (!origin || !destination) {
      return NextResponse.json(
        { success: false, error: 'Origin and destination are required' },
        { status: 400 }
      )
    }

    // Validate coordinates
    if (!origin.latitude || !origin.longitude || !destination.latitude || !destination.longitude) {
      return NextResponse.json(
        { success: false, error: 'Valid latitude and longitude are required for both origin and destination' },
        { status: 400 }
      )
    }

    // Check for valid coordinate ranges
    if (Math.abs(origin.latitude) > 90 || Math.abs(origin.longitude) > 180 ||
        Math.abs(destination.latitude) > 90 || Math.abs(destination.longitude) > 180) {
      return NextResponse.json(
        { success: false, error: 'Invalid coordinate values. Latitude must be between -90 and 90, longitude between -180 and 180' },
        { status: 400 }
      )
    }

    // Check for NaN or infinite values
    if (!Number.isFinite(origin.latitude) || !Number.isFinite(origin.longitude) ||
        !Number.isFinite(destination.latitude) || !Number.isFinite(destination.longitude)) {
      return NextResponse.json(
        { success: false, error: 'Coordinates must be valid finite numbers' },
        { status: 400 }
      )
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Google Maps API key not configured' },
        { status: 500 }
      )
    }

    // Build Google Directions API URL
    let directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?`
    directionsUrl += `origin=${origin.latitude},${origin.longitude}`
    directionsUrl += `&destination=${destination.latitude},${destination.longitude}`
    directionsUrl += `&mode=${travelMode.toLowerCase()}`
    directionsUrl += `&key=${apiKey}`

    // Add waypoints if provided
    if (waypoints.length > 0) {
      const waypointsStr = waypoints
        .map(wp => `${wp.latitude},${wp.longitude}`)
        .join('|')
      directionsUrl += `&waypoints=${optimizeWaypoints ? 'optimize:true|' : ''}${waypointsStr}`
    }

    // Add route preferences
    const avoid = []
    if (avoidHighways) avoid.push('highways')
    if (avoidTolls) avoid.push('tolls')
    if (avoid.length > 0) {
      directionsUrl += `&avoid=${avoid.join('|')}`
    }

    // Add traffic model for better time estimates
    directionsUrl += '&departure_time=now&traffic_model=best_guess'

    console.log('Directions API URL:', directionsUrl.replace(apiKey, 'API_KEY_HIDDEN'))

    const response = await fetch(directionsUrl)

    if (!response.ok) {
      throw new Error(`Google Directions API error: ${response.status}`)
    }

    const data = await response.json()

    if (data.status !== 'OK') {
      if (data.status === 'ZERO_RESULTS') {
        return NextResponse.json({
          success: false,
          error: 'No route found between the specified locations',
          data: null
        })
      }
      throw new Error(`Google Directions API error: ${data.status} - ${data.error_message || 'Unknown error'}`)
    }

    if (!data.routes || data.routes.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No routes found',
        data: null
      })
    }

    // Process the best route (first route)
    const route = data.routes[0]
    const leg = route.legs[0] // For single destination, use first leg

    // Extract route information
    const distanceMeters = leg.distance.value
    const durationSeconds = leg.duration.value
    const durationInTrafficSeconds = leg.duration_in_traffic?.value || durationSeconds

    const distanceKm = distanceMeters / 1000
    const durationMinutes = durationSeconds / 60
    const durationInTrafficMinutes = durationInTrafficSeconds / 60

    // Calculate fare estimate
    const surgeMultiplier = 1.0 // Can be made dynamic based on demand
    const fareEstimate = calculateFare(distanceKm, durationInTrafficMinutes, surgeMultiplier)

    // Format route data
    const routeData = {
      distance: {
        text: leg.distance.text,
        value: distanceMeters,
        km: distanceKm
      },
      duration: {
        text: leg.duration.text,
        value: durationSeconds,
        minutes: durationMinutes
      },
      durationInTraffic: {
        text: leg.duration_in_traffic?.text || leg.duration.text,
        value: durationInTrafficSeconds,
        minutes: durationInTrafficMinutes
      },
      startAddress: leg.start_address,
      endAddress: leg.end_address,
      steps: leg.steps.map((step: any) => ({
        instruction: step.html_instructions.replace(/<[^>]*>/g, ''), // Remove HTML tags
        distance: step.distance.text,
        duration: step.duration.text,
        startLocation: step.start_location,
        endLocation: step.end_location,
        maneuver: step.maneuver || null
      })),
      polyline: route.overview_polyline.points,
      bounds: route.bounds,
      fareEstimate,
      warnings: route.warnings || [],
      copyrights: route.copyrights
    }

    const result = {
      success: true,
      data: routeData,
      meta: {
        provider: 'Google Maps Directions API',
        travelMode,
        routeOptions: {
          avoidHighways,
          avoidTolls,
          optimizeWaypoints: waypoints.length > 0 ? optimizeWaypoints : false
        }
      }
    }

    // Cache the result
    requestCache.set(cacheKey, { result, timestamp: Date.now() })
    
    // Clean up old cache entries (keep only last 100)
    if (requestCache.size > 100) {
      const entries = Array.from(requestCache.entries())
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp)
      requestCache.clear()
      entries.slice(0, 50).forEach(([key, value]) => {
        requestCache.set(key, value)
      })
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Directions API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get directions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET method for simple route queries via URL params
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const originLat = searchParams.get('originLat')
    const originLng = searchParams.get('originLng')
    const destLat = searchParams.get('destLat')
    const destLng = searchParams.get('destLng')
    
    if (!originLat || !originLng || !destLat || !destLng) {
      return NextResponse.json(
        { success: false, error: 'Origin and destination coordinates are required' },
        { status: 400 }
      )
    }

    // Convert to POST request format
    const requestBody: DirectionsRequest = {
      origin: {
        latitude: parseFloat(originLat),
        longitude: parseFloat(originLng)
      },
      destination: {
        latitude: parseFloat(destLat),
        longitude: parseFloat(destLng)
      },
      travelMode: (searchParams.get('mode') as any) || 'DRIVING',
      avoidHighways: searchParams.get('avoidHighways') === 'true',
      avoidTolls: searchParams.get('avoidTolls') === 'true'
    }

    // Create a new request object for the POST handler
    const postRequest = new NextRequest(request.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    })

    return POST(postRequest)

  } catch (error) {
    console.error('Directions GET API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process directions request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}