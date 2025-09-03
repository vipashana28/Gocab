import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { start, end } = body

    if (!start || !end || !start.lat || !start.lng || !end.lat || !end.lng) {
      return NextResponse.json(
        { success: false, error: 'Invalid start or end coordinates' },
        { status: 400 }
      )
    }

    // OSRM (Open Source Routing Machine) API endpoint
    const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=false&alternatives=false&steps=false&annotations=false`

    const response = await fetch(osrmUrl)
    const data = await response.json()

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Could not find a route' },
        { status: 500 }
      )
    }

    const route = data.routes[0]
    const distanceMeters = route.distance // Distance in meters
    const durationSeconds = route.duration // Duration in seconds

    // Convert to miles and minutes for our app
    const distanceMiles = distanceMeters * 0.000621371
    const durationMinutes = Math.round(durationSeconds / 60)

    return NextResponse.json({
      success: true,
      data: {
        distance: Math.round(distanceMiles * 100) / 100, // miles, rounded
        duration: durationMinutes, // minutes
      },
    })
  } catch (error) {
    console.error('Directions API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch route data' },
      { status: 500 }
    )
  }
}
