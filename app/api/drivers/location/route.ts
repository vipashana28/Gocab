import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models'
import { updateDriverLocationViaPusher } from '@/lib/services/pusher'

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase()
    
    const body = await request.json()
    const { driverId, location } = body

    // Validate required fields
    if (!driverId || !location || !location.latitude || !location.longitude) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Driver ID and location (latitude, longitude) are required' 
        },
        { status: 400 }
      )
    }

    // Validate coordinates
    if (Math.abs(location.latitude) > 90 || Math.abs(location.longitude) > 180) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid coordinates' 
        },
        { status: 400 }
      )
    }

    // Update driver location in database
    const driver = await User.findByIdAndUpdate(
      driverId,
      {
        $set: {
          'driverProfile.currentLocation': {
            type: 'Point',
            coordinates: [location.longitude, location.latitude] // MongoDB uses [lng, lat]
          },
          'driverProfile.lastLocationUpdate': new Date(),
          'driverProfile.isOnline': true
        }
      },
      { 
        new: true,
        upsert: false // Don't create if doesn't exist
      }
    )

    if (!driver) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Driver not found' 
        },
        { status: 404 }
      )
    }

    console.log(`📍 Driver ${driverId} location updated:`, { 
      lat: location.latitude, 
      lng: location.longitude 
    })

    // Broadcast location update via Pusher for real-time tracking
    try {
      await updateDriverLocationViaPusher(driverId, {
        latitude: location.latitude,
        longitude: location.longitude
      })
      console.log(`✅ Pusher: Location broadcast sent for driver ${driverId}`)
    } catch (pusherError) {
      console.error('❌ Pusher location broadcast failed:', pusherError)
      // Don't fail the API call if Pusher fails
    }

    return NextResponse.json({
      success: true,
      message: 'Location updated successfully',
      data: {
        driverId,
        location,
        updatedAt: new Date()
      }
    })

  } catch (error) {
    console.error('Driver location update error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update location' 
      },
      { status: 500 }
    )
  }
}
