import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')
    const userLat = searchParams.get('lat')
    const userLon = searchParams.get('lon')
    const reverse = searchParams.get('reverse') === 'true'
    
    // For reverse geocoding, we need lat/lon instead of address
    if (reverse && (!userLat || !userLon)) {
      return NextResponse.json(
        { success: false, error: 'Latitude and longitude are required for reverse geocoding' },
        { status: 400 }
      )
    }
    
    if (!reverse && !address) {
      return NextResponse.json(
        { success: false, error: 'Address parameter is required' },
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

    // Build Google Geocoding API URL
    let geocodingUrl
    if (reverse) {
      // Reverse geocoding: lat,lng to address
      geocodingUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${userLat},${userLon}&key=${apiKey}`
    } else {
      // Forward geocoding: address to lat,lng
      geocodingUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address || '')}&key=${apiKey}`
      
      // Add geographic bias if user location is provided
      if (userLat && userLon) {
        geocodingUrl += `&region=us&bounds=${parseFloat(userLat) - 0.1},${parseFloat(userLon) - 0.1}|${parseFloat(userLat) + 0.1},${parseFloat(userLon) + 0.1}`
      }
    }
    
    const response = await fetch(geocodingUrl)

    if (!response.ok) {
      throw new Error(`Google Geocoding API error: ${response.status}`)
    }

    const data = await response.json()

    if (data.status !== 'OK') {
      if (data.status === 'ZERO_RESULTS') {
        return NextResponse.json({
          success: false,
          error: 'No results found for this address',
          data: []
        })
      }
      throw new Error(`Google Geocoding API error: ${data.status}`)
    }

    if (!data.results || data.results.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No results found for this address',
        data: []
      })
    }

    // Transform Google Geocoding results to our format
    const locations = data.results.map((result: any) => {
      const addressComponents = result.address_components || []
      const getComponent = (types: string[]) => {
        const component = addressComponents.find((comp: any) => 
          types.some((type: string) => comp.types.includes(type))
        )
        return component?.long_name || component?.short_name
      }

      return {
        address: result.formatted_address,
        coordinates: {
          latitude: result.geometry.location.lat,
          longitude: result.geometry.location.lng
        },
        details: {
          house_number: getComponent(['street_number']),
          road: getComponent(['route']),
          city: getComponent(['locality', 'sublocality']),
          state: getComponent(['administrative_area_level_1']),
          postcode: getComponent(['postal_code']),
          country: getComponent(['country']),
          type: result.types[0] || 'unknown',
          importance: 1.0 - (data.results.indexOf(result) * 0.1) // Higher for earlier results
        },
        boundingBox: result.geometry.viewport ? {
          north: result.geometry.viewport.northeast.lat,
          south: result.geometry.viewport.southwest.lat,
          east: result.geometry.viewport.northeast.lng,
          west: result.geometry.viewport.southwest.lng
        } : undefined
      }
    })

    return NextResponse.json({
      success: true,
      data: locations,
      meta: {
        query: address,
        resultsCount: locations.length,
        provider: 'Google Maps Geocoding API'
      }
    })

  } catch (error) {
    console.error('Geocoding API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to geocode address',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Reverse geocoding: Convert coordinates to address
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { latitude, longitude } = body

    if (!latitude || !longitude) {
      return NextResponse.json(
        { success: false, error: 'Latitude and longitude are required' },
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

    // Google Reverse Geocoding API
    const geocodingUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`
    
    const response = await fetch(geocodingUrl)

    if (!response.ok) {
      throw new Error(`Google Geocoding API error: ${response.status}`)
    }

    const data = await response.json()

    if (data.status !== 'OK') {
      if (data.status === 'ZERO_RESULTS') {
        return NextResponse.json({
          success: false,
          error: 'No address found for these coordinates',
          data: null
        })
      }
      throw new Error(`Google Geocoding API error: ${data.status}`)
    }

    if (!data.results || data.results.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No address found for these coordinates',
        data: null
      })
    }

    // Use the first (most precise) result
    const result = data.results[0]
    const addressComponents = result.address_components || []
    const getComponent = (types: string[]) => {
      const component = addressComponents.find((comp: any) => 
        types.some((type: string) => comp.types.includes(type))
      )
      return component?.long_name || component?.short_name
    }

    const location = {
      address: result.formatted_address,
      coordinates: {
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng
      },
      details: {
        house_number: getComponent(['street_number']),
        road: getComponent(['route']),
        city: getComponent(['locality', 'sublocality']),
        state: getComponent(['administrative_area_level_1']),
        postcode: getComponent(['postal_code']),
        country: getComponent(['country']),
        type: result.types[0] || 'unknown'
      }
    }

    return NextResponse.json({
      success: true,
      data: location,
      meta: {
        query: { latitude, longitude },
        provider: 'Google Maps Geocoding API'
      }
    })

  } catch (error) {
    console.error('Reverse geocoding API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to reverse geocode coordinates',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}