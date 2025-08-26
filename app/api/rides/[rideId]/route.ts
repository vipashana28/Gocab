import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { Ride, Driver } from '@/lib/models'
import mongoose from 'mongoose'

export async function GET(
  request: NextRequest,
  { params }: { params: { rideId: string } }
) {
  try {
    await connectToDatabase()
    
    const { rideId } = params
    
    if (!rideId) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'MISSING_RIDE_ID', 
            message: 'Ride ID is required' 
          } 
        },
        { status: 400 }
      )
    }

    // Find ride by database ID or custom rideId
    let ride
    if (mongoose.Types.ObjectId.isValid(rideId)) {
      ride = await Ride.findById(rideId)
        .populate('userId', 'firstName lastName email phone')
        .populate('driverId', 'firstName lastName phone vehicle')
    } else {
      ride = await Ride.findOne({ rideId })
        .populate('userId', 'firstName lastName email phone')
        .populate('driverId', 'firstName lastName phone vehicle')
    }

    if (!ride) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'RIDE_NOT_FOUND', 
            message: 'Ride not found' 
          } 
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: ride
    })

  } catch (error) {
    console.error('Get ride error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'DATABASE_ERROR', 
          message: 'Failed to fetch ride' 
        } 
      },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { rideId: string } }
) {
  try {
    await connectToDatabase()
    
    const { rideId } = params
    const body = await request.json()
    const { status, driverLocation, userNote } = body
    
    if (!rideId) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'MISSING_RIDE_ID', 
            message: 'Ride ID is required' 
          } 
        },
        { status: 400 }
      )
    }

    // Find ride by database ID or custom rideId
    let ride
    if (mongoose.Types.ObjectId.isValid(rideId)) {
      ride = await Ride.findById(rideId)
    } else {
      ride = await Ride.findOne({ rideId })
    }

    if (!ride) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'RIDE_NOT_FOUND', 
            message: 'Ride not found' 
          } 
        },
        { status: 404 }
      )
    }

    // Check if ride can be updated
    if (ride.status === 'completed' || ride.status === 'cancelled') {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'RIDE_CANNOT_BE_UPDATED', 
            message: 'Cannot update a completed or cancelled ride' 
          } 
        },
        { status: 400 }
      )
    }

    // Handle cancellation
    if (status === 'cancelled') {
      ride.status = 'cancelled'
      ride.cancelledAt = new Date()
      ride.cancellationReason = userNote || 'Cancelled by user'
      
      // If driver was assigned, make them available again
      if (ride.driverId) {
        try {
          const driver = await Driver.findById(ride.driverId)
          if (driver) {
            driver.isAvailable = true
            await driver.save()
          }
        } catch (error) {
          console.error('Error updating driver availability:', error)
        }
      }
    } else {
      // Update other fields
      if (status) ride.status = status
      if (driverLocation) {
        ride.driverLocation = {
          coordinates: driverLocation.coordinates,
          lastUpdated: new Date()
        }
      }
    }

    await ride.save()

    // Populate driver info for response
    await ride.populate('driverId', 'firstName lastName phone vehicle')
    
    return NextResponse.json({
      success: true,
      data: {
        id: ride._id,
        rideId: ride.rideId,
        status: ride.status,
        statusDisplay: ride.statusDisplay,
        pickup: ride.pickup,
        destination: ride.destination,
        driverContact: ride.driverContact,
        driverLocation: ride.driverLocation,
        cancelledAt: ride.cancelledAt,
        cancellationReason: ride.cancellationReason
      },
      message: status === 'cancelled' ? 'Ride cancelled successfully' : 'Ride updated successfully'
    })

  } catch (error) {
    console.error('Update ride error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'DATABASE_ERROR', 
          message: 'Failed to update ride' 
        } 
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { rideId: string } }
) {
  try {
    await connectToDatabase()
    
    const { rideId } = params
    
    if (!rideId) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'MISSING_RIDE_ID', 
            message: 'Ride ID is required' 
          } 
        },
        { status: 400 }
      )
    }

    // Find ride by database ID or custom rideId
    let ride
    if (mongoose.Types.ObjectId.isValid(rideId)) {
      ride = await Ride.findById(rideId)
    } else {
      ride = await Ride.findOne({ rideId })
    }

    if (!ride) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'RIDE_NOT_FOUND', 
            message: 'Ride not found' 
          } 
        },
        { status: 404 }
      )
    }

    // Check if ride can be cancelled
    if (ride.status === 'completed') {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'RIDE_CANNOT_BE_CANCELLED', 
            message: 'Cannot cancel a completed ride' 
          } 
        },
        { status: 400 }
      )
    }

    // Cancel the ride instead of deleting it (soft delete)
    ride.status = 'cancelled'
    ride.cancelledAt = new Date()
    ride.cancellationReason = 'Cancelled by user'
    
    // If driver was assigned, make them available again
    if (ride.driverId) {
      try {
        const driver = await Driver.findById(ride.driverId)
        if (driver) {
          driver.isAvailable = true
          await driver.save()
        }
      } catch (error) {
        console.error('Error updating driver availability:', error)
      }
    }

    await ride.save()
    
    return NextResponse.json({
      success: true,
      data: {
        id: ride._id,
        rideId: ride.rideId,
        status: ride.status,
        cancelledAt: ride.cancelledAt
      },
      message: 'Ride cancelled successfully'
    })

  } catch (error) {
    console.error('Cancel ride error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'DATABASE_ERROR', 
          message: 'Failed to cancel ride' 
        } 
      },
      { status: 500 }
    )
  }
}