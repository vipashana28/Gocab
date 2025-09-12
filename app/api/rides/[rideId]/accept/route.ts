import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { Ride, User } from '@/lib/models'
import mongoose from 'mongoose'

export async function POST(
  request: NextRequest,
  { params }: { params: { rideId: string } }
) {
  try {
    await connectToDatabase()
    
    const { rideId } = params
    const body = await request.json()
    const { driverId, action } = body // action: 'accept' | 'decline'

    // Validate driver ID
    if (!mongoose.Types.ObjectId.isValid(driverId)) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_DRIVER_ID',
          message: 'Invalid driver ID format'
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

    // Check if ride is still available for acceptance
    if (ride.status !== 'requested') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'RIDE_NOT_AVAILABLE',
          message: 'Ride is no longer available for acceptance'
        }
      }, { status: 409 })
    }

    // Get driver details
    const driver = await User.findById(driverId)
    if (!driver || !driver.driverProfile?.isOnline) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'DRIVER_NOT_AVAILABLE',
          message: 'Driver not found or not online'
        }
      }, { status: 404 })
    }

    if (action === 'decline') {
      // Log the decline (for analytics) but don't change ride status
      console.log(`Driver ${driverId} declined ride ${rideId}`)
      
      return NextResponse.json({
        success: true,
        message: 'Ride declined'
      })
    }

    if (action === 'accept') {
      // Check if driver is within reasonable distance (10km)
      const driverCoords = driver.driverProfile.currentLocation.coordinates // [lng, lat]
      const driverLocation = {
        latitude: driverCoords[1],
        longitude: driverCoords[0]
      }
      
      const pickupCoords = ride.pickup.coordinates
      const distance = Math.sqrt(
        Math.pow(driverLocation.latitude - pickupCoords.latitude, 2) +
        Math.pow(driverLocation.longitude - pickupCoords.longitude, 2)
      ) * 111 // Rough conversion to km
      
      if (distance > 10) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'DRIVER_TOO_FAR',
            message: 'Driver is too far from pickup location'
          }
        }, { status: 400 })
      }

      // Calculate estimated arrival time
      const estimatedArrivalMinutes = Math.max(2, Math.min(15, Math.round(distance * 3))) // 2-15 minutes based on distance

      // Update ride with driver assignment
      ride.status = 'matched'
      ride.matchedAt = new Date()
      ride.driverId = driverId
      ride.driverContact = {
        phone: driver.phone || '+1 (555) 000-0000',
        name: `${driver.firstName} ${driver.lastName}`,
        vehicleInfo: driver.driverProfile?.vehicleInfo || '2023 Toyota Camry - Blue',
        licensePlate: driver.driverProfile?.licensePlate || 'GC-' + Math.floor(Math.random() * 999).toString().padStart(3, '0'),
        photo: driver.profilePicture || `https://i.pravatar.cc/150?u=${driver.email}`,
        rating: driver.driverProfile?.rating || 4.8
      }
      ride.driverLocation = {
        coordinates: driverLocation,
        lastUpdated: new Date()
      }
      ride.estimatedArrival = `${estimatedArrivalMinutes} minutes`
      ride.statusDisplay = 'Driver Found'
      
      await ride.save()

      // Mark driver as busy (optional - depends on business logic)
      driver.driverProfile.isOnline = true // Keep online but they'll get filtered out by having an active ride
      await driver.save()

      return NextResponse.json({
        success: true,
        data: {
          id: ride._id,
          rideId: ride.rideId,
          pickupCode: ride.pickupCode,
          otp: ride.otp,
          status: ride.status,
          statusDisplay: ride.statusDisplay,
          pickup: ride.pickup,
          destination: ride.destination,
          driverContact: ride.driverContact,
          driverLocation: ride.driverLocation,
          estimatedArrival: ride.estimatedArrival,
          matchedAt: ride.matchedAt
        },
        message: 'Ride accepted successfully'
      })
    }

    return NextResponse.json({
      success: false,
      error: {
        code: 'INVALID_ACTION',
        message: 'Action must be either "accept" or "decline"'
      }
    }, { status: 400 })

  } catch (error) {
    console.error('Ride accept/decline error:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to process ride request'
      }
    }, { status: 500 })
  }
}
