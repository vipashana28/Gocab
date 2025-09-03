import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')
    const userLat = searchParams.get('lat')
    const userLon = searchParams.get('lon')
    
    if (!address) {
      return NextResponse.json(
        { success: false, error: 'Address parameter is required' },
        { status: 400 }
      )
    }

    // Use Nominatim (OpenStreetMap) geocoding service - improved approach
    let nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=8&addressdetails=1&extratags=1`
    
    // Add geographic bias if user location is provided
    if (userLat && userLon) {
      nominatimUrl += `&viewbox=${parseFloat(userLon) - 0.5},${parseFloat(userLat) + 0.5},${parseFloat(userLon) + 0.5},${parseFloat(userLat) - 0.5}&bounded=0`
    }
    // NOTE: Removed country restriction as it was too limiting even for valid addresses
    
    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'GoCab/1.0 (Ride booking app)', // Required by Nominatim
      }
    })

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`)
    }

    const results = await response.json()

    if (!results || results.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No results found for this address',
        data: []
      })
    }

    // Transform Nominatim results to our format
    const locations = results.map((result: any) => ({
      address: result.display_name,
      coordinates: {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon)
      },
      details: {
        house_number: result.address?.house_number,
        road: result.address?.road,
        city: result.address?.city || result.address?.town || result.address?.village,
        state: result.address?.state,
        postcode: result.address?.postcode,
        country: result.address?.country,
        type: result.type, // e.g., 'house', 'building', 'way'
        importance: parseFloat(result.importance || 0)
      },
      boundingBox: result.boundingbox ? {
        north: parseFloat(result.boundingbox[1]),
        south: parseFloat(result.boundingbox[0]),
        east: parseFloat(result.boundingbox[3]),
        west: parseFloat(result.boundingbox[2])
      } : null
    }))

    return NextResponse.json({
      success: true,
      data: locations,
      meta: {
        query: address,
        resultsCount: locations.length,
        provider: 'Nominatim/OpenStreetMap'
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

    // Nominatim reverse geocoding
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&extratags=1`
    
    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'GoCab/1.0 (Ride booking app)',
      }
    })

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`)
    }

    const result = await response.json()

    if (!result || result.error) {
      return NextResponse.json({
        success: false,
        error: 'No address found for these coordinates',
        data: null
      })
    }

    const location = {
      address: result.display_name,
      coordinates: {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon)
      },
      details: {
        house_number: result.address?.house_number,
        road: result.address?.road,
        city: result.address?.city || result.address?.town || result.address?.village,
        state: result.address?.state,
        postcode: result.address?.postcode,
        country: result.address?.country,
        type: result.type
      }
    }

    return NextResponse.json({
      success: true,
      data: location,
      meta: {
        query: { latitude, longitude },
        provider: 'Nominatim/OpenStreetMap'
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
