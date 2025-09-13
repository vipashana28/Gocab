import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { Ride, Driver } from '@/lib/models'
import mongoose from 'mongoose'
import { notifyRiderStatusUpdate } from '../../../../../pages/api/socket'

export async function POST(
  request: NextRequest,
  { params }: { params: { rideId: string } }
) {
  try {
    await connectToDatabase()
    
    const { rideId } = params
    const body = await request.json()
    const { driverId, driverLocation } = body

    console.log(' Driver accepting ride:', { rideId, driverId })

    // Validate required fields
    if (!driverId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_DRIVER_ID',
          message: 'Driver ID is required'
        }
      }, { status: 400 })
    }

    // Validate driver location if provided
    if (driverLocation) {
      if (typeof driverLocation.latitude !== 'number' || 
          typeof driverLocation.longitude !== 'number' ||
          !Number.isFinite(driverLocation.latitude) ||
          !Number.isFinite(driverLocation.longitude)) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'INVALID_LOCATION',
            message: 'Valid driver location (latitude, longitude) is required'
          }
        }, { status: 400 })
      }
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

    // Check if ride is in correct status for acceptance
    if (ride.status !== 'requested') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_RIDE_STATUS',
          message: `Ride cannot be accepted. Current status: ${ride.status}`
        }
      }, { status: 400 })
    }

    // Check if ride already has a driver
    if (ride.driverId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'RIDE_ALREADY_ASSIGNED',
          message: 'Ride is already assigned to another driver'
        }
      }, { status: 409 })
    }

    // Find and validate the driver
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

    // Check if driver is available
    if (!driver.isAvailable || !driver.isOnline || driver.status !== 'active') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'DRIVER_NOT_AVAILABLE',
          message: 'Driver is not available for rides'
        }
      }, { status: 400 })
    }

    // Update ride with driver assignment
    const updateData: any = {
      driverId: new mongoose.Types.ObjectId(driverId),
      status: 'matched',
      matchedAt: new Date(),
      driverContact: {
        name: driver.firstName + ' ' + (driver.lastName || ''),
        phone: driver.phone,
        vehicleInfo: `${driver.vehicle.make} ${driver.vehicle.model} (${driver.vehicle.color})`,
        licensePlate: driver.vehicle.licensePlate,
        photo: driver.profilePhoto
      }
    }

    // Add driver location if provided
    if (driverLocation) {
      updateData.driverLocation = {
        coordinates: {
          latitude: driverLocation.latitude,
          longitude: driverLocation.longitude
        },
        lastUpdated: new Date()
      }
    }

    const updatedRide = await Ride.findByIdAndUpdate(
      ride._id,
      updateData,
      { new: true }
    )

    // Update driver availability
    await Driver.findByIdAndUpdate(driverId, {
      isAvailable: false,
      currentRideId: ride._id,
      lastLocationUpdate: new Date(),
      ...(driverLocation && {
        'currentLocation.coordinates': [driverLocation.longitude, driverLocation.latitude],
        'currentLocation.lastUpdated': new Date()
      })
    })

    console.log('✅ Ride accepted successfully:', updatedRide._id)

    // Notify rider in real-time about driver assignment
    try {
      await notifyRiderStatusUpdate(updatedRide.userId.toString(), {
        id: updatedRide._id,
        rideId: updatedRide.rideId,
        status: updatedRide.status,
        statusDisplay: 'Driver Assigned - En Route',
        driverContact: updatedRide.driverContact,
        driverLocation: updatedRide.driverLocation,
        matchedAt: updatedRide.matchedAt,
        otp: updatedRide.otp,
        pickupCode: updatedRide.pickupCode
      })
      console.log('📱 Rider notified via WebSocket about driver assignment')
    } catch (notificationError) {
      console.error('❌ Failed to notify rider:', notificationError)
      // Don't fail the acceptance if notifications fail
    }

    return NextResponse.json({
      success: true,
      message: 'Ride accepted successfully',
      data: {
        rideId: updatedRide.rideId,
        status: updatedRide.status,
        driverId: updatedRide.driverId,
        driverContact: updatedRide.driverContact,
        matchedAt: updatedRide.matchedAt,
        pickup: updatedRide.pickup,
        destination: updatedRide.destination,
        otp: updatedRide.otp,
        pickupCode: updatedRide.pickupCode
      }
    })

  } catch (error: any) {
    console.error('❌ Error accepting ride:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to accept ride',
        details: error.message
      }
    }, { status: 500 })
  }
}

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
    }).populate('driverId', 'firstName lastName phone vehicle profilePhoto')

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
        pickup: ride.pickup,
        destination: ride.destination,
        driverContact: ride.driverContact,
        driverLocation: ride.driverLocation,
        otp: ride.otp,
        pickupCode: ride.pickupCode,
        requestedAt: ride.requestedAt,
        matchedAt: ride.matchedAt
      }
    })

  } catch (error: any) {
    console.error('❌ Error fetching ride:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch ride details',
        details: error.message
      }
    }, { status: 500 })
  }
}