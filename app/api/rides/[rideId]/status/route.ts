import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { Ride } from '@/lib/models'
import mongoose from 'mongoose'
import { notifyRiderStatusUpdateViaPusher } from '@/lib/services/pusher'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { rideId: string } }
) {
  try {
    await connectToDatabase()
    
    const { rideId } = params
    const body = await request.json()
    const { status, driverId } = body

    console.log('🔄 Updating ride status:', { rideId, status, driverId })

    // Validate required fields
    if (!status || !driverId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Status and driver ID are required'
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
    if (ride.driverId?.toString() !== driverId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Driver not authorized to update this ride'
        }
      }, { status: 403 })
    }

    // Update ride status
    const updatedRide = await Ride.findByIdAndUpdate(
      ride._id,
      { 
        status,
        ...(status === 'in_progress' && { startedAt: new Date() }),
        ...(status === 'completed' && { completedAt: new Date() })
      },
      { new: true }
    )

    console.log('✅ Ride status updated:', updatedRide.status)

    // Notify rider about status change
    try {
      let statusDisplay = ''
      switch (status) {
        case 'in_progress':
          statusDisplay = 'Ride Started - En Route to Destination'
          break
        case 'completed':
          statusDisplay = 'Ride Completed - Thank You!'
          break
        default:
          statusDisplay = `Status: ${status}`
      }

      await notifyRiderStatusUpdateViaPusher(updatedRide.userId.toString(), {
        id: updatedRide._id,
        rideId: updatedRide.rideId,
        status: updatedRide.status,
        statusDisplay,
        driverContact: updatedRide.driverContact,
        driverLocation: updatedRide.driverLocation,
        otp: updatedRide.otp,
        pickupCode: updatedRide.pickupCode
      })
      console.log('📱 Rider notified about status change')
    } catch (notificationError) {
      console.error('❌ Failed to notify rider:', notificationError)
      // Don't fail the status update if notifications fail
    }

    return NextResponse.json({
      success: true,
      message: 'Ride status updated successfully',
      data: {
        rideId: updatedRide.rideId,
        status: updatedRide.status,
        statusDisplay: status === 'in_progress' ? 'Ride Started' : status === 'completed' ? 'Ride Completed' : status
      }
    })

  } catch (error: any) {
    console.error('❌ Error updating ride status:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update ride status',
        details: error.message
      }
    }, { status: 500 })
  }
}
