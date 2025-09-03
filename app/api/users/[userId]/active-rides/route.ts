import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { Ride } from '@/lib/models'
import mongoose from 'mongoose'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    await connectToDatabase()
    
    const { userId } = params
    
    if (!userId) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'MISSING_USER_ID', 
            message: 'User ID is required' 
          } 
        },
        { status: 400 }
      )
    }

    // Find all active rides for the user
    const activeRides = await Ride.find({
      userId,
      status: { $in: ['requested', 'matched', 'driver_en_route', 'arrived', 'in_progress'] }
    })

    if (activeRides.length === 0) {
      return NextResponse.json({
        success: true,
        data: { cleared: 0 },
        message: 'No active rides found for user'
      })
    }

    // Mark all active rides as completed (admin action)
    const updateResult = await Ride.updateMany(
      {
        userId,
        status: { $in: ['requested', 'matched', 'driver_en_route', 'arrived', 'in_progress'] }
      },
      {
        $set: {
          status: 'completed',
          completedAt: new Date(),
          cancellationReason: 'Cleared by admin - stale ride cleanup'
        }
      }
    )

    return NextResponse.json({
      success: true,
      data: { 
        cleared: updateResult.modifiedCount,
        rideIds: activeRides.map(ride => ride.rideId)
      },
      message: `Cleared ${updateResult.modifiedCount} stale active rides for user`
    })

  } catch (error) {
    console.error('Clear active rides error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'DATABASE_ERROR', 
          message: 'Failed to clear active rides' 
        } 
      },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    await connectToDatabase()
    
    const { userId } = params
    
    if (!userId) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'MISSING_USER_ID', 
            message: 'User ID is required' 
          } 
        },
        { status: 400 }
      )
    }

    // Find all active rides for the user
    const activeRides = await Ride.find({
      userId,
      status: { $in: ['requested', 'matched', 'driver_en_route', 'arrived', 'in_progress'] }
    }).populate('driverId', 'firstName lastName phone vehicle')

    return NextResponse.json({
      success: true,
      data: activeRides,
      message: `Found ${activeRides.length} active rides for user`
    })

  } catch (error) {
    console.error('Get active rides error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'DATABASE_ERROR', 
          message: 'Failed to fetch active rides' 
        } 
      },
      { status: 500 }
    )
  }
}
