import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { Ride } from '@/lib/models'
import mongoose from 'mongoose'

export async function POST(
  request: NextRequest,
  { params }: { params: { rideId: string } }
) {
  try {
    await connectToDatabase()
    
    const { rideId } = params
    const body = await request.json()
    const { driverId, location, heading } = body

    // Validate required fields
    if (!driverId || !location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_DATA',
          message: 'Driver ID and valid location (latitude, longitude) are required'
        }
      }, { status: 400 })
    }

    // Validate coordinates
    if (location.latitude < -90 || location.latitude > 90 || 
        location.longitude < -180 || location.longitude > 180) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_COORDINATES',
          message: 'Invalid latitude or longitude values'
        }
      }, { status: 400 })
    }

    // Find the ride
    const ride = await Ride.findOne({ 
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(rideId) ? rideId : null },
        { rideId: rideId }
      ]
    })

    if (!ride) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'RIDE_NOT_FOUND',
          message: 'Ride not found'
        }
      }, { status: 404 })
    }

    // Verify the driver is assigned to this ride
    if (!ride.driverId || ride.driverId.toString() !== driverId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED_DRIVER',
          message: 'Driver not authorized for this ride'
        }
      }, { status: 403 })
    }

    // Only update location for active rides
    if (!['matched', 'driver_en_route', 'arrived', 'in_progress'].includes(ride.status)) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'RIDE_NOT_ACTIVE',
          message: 'Cannot update location for inactive ride'
        }
      }, { status: 400 })
    }

    // Update driver location
    ride.driverLocation = {
      coordinates: {
        latitude: location.latitude,
        longitude: location.longitude
      },
      heading: heading || undefined,
      lastUpdated: new Date()
    }

    await ride.save()

    return NextResponse.json({
      success: true,
      data: {
        rideId: ride.rideId,
        driverLocation: ride.driverLocation,
        status: ride.status
      },
      message: 'Driver location updated successfully'
    })

  } catch (error) {
    console.error('Update driver location error:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to update driver location'
      }
    }, { status: 500 })
  }
}

// GET endpoint to retrieve current driver location for a ride
export async function GET(
  request: NextRequest,
  { params }: { params: { rideId: string } }
) {
  try {
    await connectToDatabase()
    
    const { rideId } = params

    // Find the ride
    const ride = await Ride.findOne({ 
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(rideId) ? rideId : null },
        { rideId: rideId }
      ]
    }).select('rideId status driverLocation estimatedArrival statusDisplay')

    if (!ride) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'RIDE_NOT_FOUND',
          message: 'Ride not found'
        }
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        rideId: ride.rideId,
        status: ride.status,
        statusDisplay: ride.statusDisplay,
        driverLocation: ride.driverLocation,
        estimatedArrival: ride.estimatedArrival,
        lastUpdated: ride.driverLocation?.lastUpdated
      }
    })

  } catch (error) {
    console.error('Get driver location error:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to retrieve driver location'
      }
    }, { status: 500 })
  }
}
