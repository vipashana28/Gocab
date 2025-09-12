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
      if (status) {
        // Use the model's updateStatus method for proper timestamp handling
        if (status === 'completed') {
          // Handle ride completion with trip summary
          const completedAt = new Date()
          const startedAt = ride.startedAt || ride.requestedAt
          const duration = Math.round((completedAt.getTime() - startedAt.getTime()) / (1000 * 60)) // minutes
          
          // Calculate approximate distance (could be enhanced with real route data)
          const distance = ride.route?.distance || calculateDistance(
            ride.pickup.coordinates.latitude,
            ride.pickup.coordinates.longitude,
            ride.destination.coordinates.latitude,
            ride.destination.coordinates.longitude
          )
          
          await ride.updateStatus('completed', {
            'route.actualDistance': distance,
            'route.actualDuration': duration,
            'route.actualFare': ride.pricing.totalEstimated, // For now, use estimated
            'carbonFootprint.actualSaved': ride.carbonFootprint.estimatedSaved,
            'pricing.totalActual': ride.pricing.totalEstimated
          })
        } else {
          await ride.updateStatus(status)
        }
      }
      
      if (driverLocation) {
        ride.driverLocation = {
          coordinates: driverLocation.coordinates,
          lastUpdated: new Date()
        }
        await ride.save()
      }
    }

    // Populate driver info for response
    await ride.populate('driverId', 'firstName lastName phone vehicle')
    
    // Enhanced response data for completed rides
    const responseData: any = {
      id: ride._id,
      rideId: ride.rideId,
      status: ride.status,
      statusDisplay: ride.statusDisplay,
      pickup: ride.pickup,
      destination: ride.destination,
      driverContact: ride.driverContact,
      driverLocation: ride.driverLocation,
      pricing: ride.pricing,
      carbonFootprint: ride.carbonFootprint,
      cancelledAt: ride.cancelledAt,
      cancellationReason: ride.cancellationReason
    }

    // Add trip summary for completed rides
    if (ride.status === 'completed') {
      const distance = ride.route?.actualDistance || ride.route?.distance || 8.5
      const carbonSaved = ride.carbonFootprint?.actualSaved || ride.carbonFootprint?.estimatedSaved || (distance * 0.21)
      
      responseData.tripSummary = {
        duration: ride.totalDuration || 25, // Virtual field or fallback
        distance: Math.round(distance * 100) / 100,
        actualFare: ride.route?.actualFare || ride.pricing?.totalEstimated || 25.13,
        carbonSaved: Math.round(carbonSaved * 100) / 100,
        fuelSaved: Math.round(distance * 0.08 * 100) / 100, // Estimated fuel saved in liters
        treeEquivalent: Math.round(carbonSaved * 2.47), // Trees equivalent to carbon saved
        completedAt: ride.completedAt
      }
    }
    
    return NextResponse.json({
      success: true,
      data: responseData,
      message: status === 'cancelled' ? 'Ride cancelled successfully' : 
               status === 'completed' ? 'Trip completed successfully' : 'Ride updated successfully'
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