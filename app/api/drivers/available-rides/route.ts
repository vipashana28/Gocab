import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { Ride, Driver } from '@/lib/models'
import mongoose from 'mongoose'

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959 // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c // Distance in miles
}

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase()
    
    const { searchParams } = new URL(request.url)
    const driverId = searchParams.get('driverId')
    const latitude = searchParams.get('lat')
    const longitude = searchParams.get('lng')
    const maxDistance = parseInt(searchParams.get('maxDistance') || '5000') // 5km default
    const limit = parseInt(searchParams.get('limit') || '10')

    console.log(' Finding available rides for driver:', { driverId, latitude, longitude, maxDistance })

    if (!driverId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_DRIVER_ID',
          message: 'Driver ID is required'
        }
      }, { status: 400 })
    }

    // Validate driver exists and is available
    const driver = await Driver.findById(driverId)
    if (!driver) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'DRIVER_NOT_FOUND',
          message: 'Driver not found'
        }
      }, { status: 404 })
    }

    if (!driver.isOnline || driver.status !== 'active') {
      return NextResponse.json({
        success: true,
        data: [],
        message: 'Driver is not online or active'
      })
    }

    // Build query for available rides
    let query: any = {
      status: 'requested', // Only rides that haven't been accepted yet
      driverId: { $exists: false } // No driver assigned yet
    }

    let rides

    // Location-based search if coordinates provided
    if (latitude && longitude) {
      const lat = parseFloat(latitude)
      const lng = parseFloat(longitude)
      
      // Validate coordinates
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || 
          lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'INVALID_COORDINATES',
            message: 'Invalid latitude or longitude values'
          }
        }, { status: 400 })
      }

      // Find all rides and filter by distance manually
      const allRides = await Ride.find(query)
        .sort({ requestedAt: 1 }) // Oldest first
        .lean()
      
      // Filter rides by distance
      rides = allRides.filter((ride: any) => {
        if (!ride.pickup?.coordinates?.latitude || !ride.pickup?.coordinates?.longitude) {
          return false
        }
        
        const distance = calculateDistance(
          lat, lng,
          ride.pickup.coordinates.latitude,
          ride.pickup.coordinates.longitude
        )
        
        // Convert maxDistance from meters to miles (1 meter = 0.000621371 miles)
        const maxDistanceMiles = maxDistance * 0.000621371
        return distance <= maxDistanceMiles
      }).slice(0, limit)

    } else {
      // General search without location filtering
      rides = await Ride.find(query)
        .sort({ requestedAt: 1 })
        .limit(limit)
        .lean()
    }

    // Calculate distance and estimated time for each ride
    const ridesWithDistance = rides.map((ride: any) => {
      let distanceToPickup = null
      let estimatedTime = null

      if (latitude && longitude && ride.pickup?.coordinates) {
        // Calculate distance to pickup location
        const pickupLat = ride.pickup.coordinates.latitude
        const pickupLng = ride.pickup.coordinates.longitude
        
        if (Number.isFinite(pickupLat) && Number.isFinite(pickupLng)) {
          // Simple haversine distance calculation
          const R = 6371 // Earth's radius in km
          const dLat = (pickupLat - parseFloat(latitude)) * Math.PI / 180
          const dLng = (pickupLng - parseFloat(longitude)) * Math.PI / 180
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                   Math.cos(parseFloat(latitude) * Math.PI / 180) * Math.cos(pickupLat * Math.PI / 180) *
                   Math.sin(dLng/2) * Math.sin(dLng/2)
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
          distanceToPickup = R * c // Distance in km

          // Estimate time (assuming 30 km/h average speed in city)
          estimatedTime = Math.round((distanceToPickup / 30) * 60) // Minutes
        }
      }

      return {
        id: ride._id,
        rideId: ride.rideId,
        pickup: ride.pickup,
        destination: ride.destination,
        requestedAt: ride.requestedAt,
        otp: ride.otp,
        pickupCode: ride.pickupCode,
        pricing: ride.pricing,
        distanceToPickup: distanceToPickup ? Math.round(distanceToPickup * 100) / 100 : null, // Round to 2 decimals
        estimatedTimeToPickup: estimatedTime,
        route: ride.route
      }
    })

    console.log(`Found ${ridesWithDistance.length} available rides for driver ${driverId}`)

    return NextResponse.json({
      success: true,
      data: ridesWithDistance,
      meta: {
        total: ridesWithDistance.length,
        driverId,
        searchRadius: maxDistance,
        driverLocation: latitude && longitude ? { latitude: parseFloat(latitude), longitude: parseFloat(longitude) } : null
      }
    })

  } catch (error: any) {
    console.error(' Error fetching available rides:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch available rides',
        details: error.message
      }
    }, { status: 500 })
  }
}

// POST endpoint for driver to update their availability status
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase()
    
    const body = await request.json()
    const { driverId, isAvailable, location } = body

    console.log('Updating driver availability:', { driverId, isAvailable })

    if (!driverId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_DRIVER_ID',
          message: 'Driver ID is required'
        }
      }, { status: 400 })
    }

    // Validate location if provided
    if (location) {
      if (typeof location.latitude !== 'number' || 
          typeof location.longitude !== 'number' ||
          !Number.isFinite(location.latitude) ||
          !Number.isFinite(location.longitude)) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'INVALID_LOCATION',
            message: 'Valid location (latitude, longitude) is required'
          }
        }, { status: 400 })
      }
    }

    const updateData: any = {
      isAvailable: !!isAvailable,
      lastLocationUpdate: new Date()
    }

    if (location) {
      updateData['currentLocation.coordinates'] = [location.longitude, location.latitude]
      updateData['currentLocation.lastUpdated'] = new Date()
    }

    const driver = await Driver.findByIdAndUpdate(
      driverId,
      updateData,
      { new: true }
    )

    if (!driver) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'DRIVER_NOT_FOUND',
          message: 'Driver not found'
        }
      }, { status: 404 })
    }

    console.log(' Driver availability updated successfully')

    return NextResponse.json({
      success: true,
      message: 'Driver availability updated',
      data: {
        driverId: driver._id,
        isAvailable: driver.isAvailable,
        isOnline: driver.isOnline,
        status: driver.status,
        lastLocationUpdate: driver.lastLocationUpdate
      }
    })

  } catch (error: any) {
    console.error(' Error updating driver availability:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update driver availability',
        details: error.message
      }
    }, { status: 500 })
  }
}
