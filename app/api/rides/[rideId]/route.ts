import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { Ride, Driver, User } from '@/lib/models'

export async function GET(
  request: NextRequest,
  { params }: { params: { rideId: string } }
) {
  try {
    await connectToDatabase()
    
    const { rideId } = params

    const ride = await Ride.findOne({ rideId })
      .populate('userId', 'firstName lastName email phone')
      .populate('driverId', 'firstName lastName phone vehicle')

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
      data: {
        ...ride.toObject(),
        statusDisplay: ride.statusDisplay,
        totalDuration: ride.totalDuration,
        waitTime: ride.waitTime
      }
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
    const { status, driverLocation, driverId, cancelledBy, cancellationReason } = body

    const ride = await Ride.findOne({ rideId })
    
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

    // Update driver location if provided
    if (driverLocation && driverLocation.coordinates) {
      await ride.updateDriverLocation(
        driverLocation.coordinates.latitude,
        driverLocation.coordinates.longitude,
        driverLocation.heading
      )
    }

    // Update ride status if provided
    if (status) {
      let additionalData: any = {}
      
      // Handle status-specific updates
      if (status === 'matched' && driverId) {
        const driver = await Driver.findById(driverId)
        if (!driver) {
          return NextResponse.json(
            { 
              success: false, 
              error: { 
                code: 'DRIVER_NOT_FOUND', 
                message: 'Driver not found' 
              } 
            },
            { status: 404 }
          )
        }
        
        additionalData.driverId = driverId
        additionalData.driverContact = {
          phone: driver.phone,
          name: driver.fullName,
          vehicleInfo: driver.vehicleDisplayName,
          licensePlate: driver.vehicle.licensePlate
        }
        
        // Update driver availability
        driver.isAvailable = false
        await driver.save()
      }
      
      if (status === 'cancelled') {
        additionalData.cancelledBy = cancelledBy || 'user'
        additionalData.cancellationReason = cancellationReason || 'User cancelled'
        
        // Make driver available again if assigned
        if (ride.driverId) {
          const driver = await Driver.findById(ride.driverId)
          if (driver) {
            driver.isAvailable = true
            await driver.save()
          }
        }
      }
      
      if (status === 'completed') {
        // Calculate actual fare, distance, and carbon savings
        if (ride.route.actualDistance && ride.route.actualDuration) {
          const actualCarbonSaved = ride.route.actualDistance * 0.404 * 0.6
          additionalData['carbonFootprint.actualSaved'] = actualCarbonSaved
          
          // Update user's total carbon saved
          const user = await User.findById(ride.userId)
          if (user) {
            await user.completeRide(actualCarbonSaved)
          }
          
          // Update driver stats
          if (ride.driverId) {
            const driver = await Driver.findById(ride.driverId)
            if (driver) {
              const earnings = ride.pricing.totalActual || ride.pricing.totalEstimated
              await driver.completeRide(
                ride.route.actualDistance || ride.route.distance,
                earnings,
                actualCarbonSaved
              )
              driver.isAvailable = true
              await driver.save()
            }
          }
        }
      }
      
      await ride.updateStatus(status, additionalData)
    }

    // Populate and return updated ride
    await ride.populate('userId', 'firstName lastName email phone')
    await ride.populate('driverId', 'firstName lastName phone vehicle')

    return NextResponse.json({
      success: true,
      data: {
        ...ride.toObject(),
        statusDisplay: ride.statusDisplay,
        totalDuration: ride.totalDuration,
        waitTime: ride.waitTime
      },
      message: 'Ride updated successfully'
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

    const ride = await Ride.findOne({ rideId })
    
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

    // Can only delete rides that are not in progress
    if (['in_progress', 'driver_en_route', 'arrived'].includes(ride.status)) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'RIDE_IN_PROGRESS', 
            message: 'Cannot delete ride that is in progress' 
          } 
        },
        { status: 400 }
      )
    }

    // Make driver available again if assigned
    if (ride.driverId && ['matched', 'driver_en_route', 'arrived'].includes(ride.status)) {
      const driver = await Driver.findById(ride.driverId)
      if (driver) {
        driver.isAvailable = true
        await driver.save()
      }
    }

    await Ride.deleteOne({ rideId })

    return NextResponse.json({
      success: true,
      message: 'Ride deleted successfully'
    })

  } catch (error) {
    console.error('Delete ride error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'DATABASE_ERROR', 
          message: 'Failed to delete ride' 
        } 
      },
      { status: 500 }
    )
  }
}
