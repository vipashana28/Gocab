import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { Ride, User } from '@/lib/models'
import mongoose from 'mongoose'
import { notifyNearbyDriversViaPusher } from '@/lib/services/pusher'

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase()
    
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const status = searchParams.get('status')
    
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

    // Build query
    const query: any = { userId }
    
    if (status) {
      const statusArray = status.split(',')
      query.status = { $in: statusArray }
    }

    const rides = await Ride.find(query)
      .sort({ createdAt: -1 })
      .limit(50)

    return NextResponse.json(
      { 
        success: true, 
        data: rides,
        count: rides.length
      },
      { status: 200 }
    )

  } catch (error: any) {
    console.error('Get rides error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'DATABASE_ERROR', 
          message: 'Failed to fetch rides' 
        } 
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  console.log('=== RIDE API CALLED ===')
  
  try {
    console.log('Step 1: Connecting to database...')
    await connectToDatabase()
    console.log('Step 1: Database connected')
    
    console.log('Step 2: Parsing request body...')
    const body = await request.json()
    console.log('Step 2: Body parsed:', JSON.stringify(body, null, 2))
    
    console.log('Step 3: Creating ride data...')
    
    // Generate random OTP (4 digits) and pickup code (6 digits)
    const otp = Math.floor(1000 + Math.random() * 9000).toString()
    const pickupCode = Math.floor(100000 + Math.random() * 900000).toString()
    
    const rideData = {
      rideId: 'SIMPLE_' + Date.now(),
      pickupCode: pickupCode,
      otp: otp,
      userId: new mongoose.Types.ObjectId(body.userId),
      pickup: body.pickup,
      destination: body.destination,
      route: {
        distance: 10.5,
        estimatedDuration: 25,
        estimatedFare: 15.75
      },
      carbonFootprint: {
        estimatedSaved: 2.1
      },
      pricing: {
        baseFare: 3.5,
        distanceFee: 10.0,
        timeFee: 2.25,
        totalEstimated: 15.75,
        currency: 'USD',
        isSponsored: false
      },
      platform: 'web'
    }
    console.log('Step 3: Ride data created')
    
    console.log('Step 4: Creating Ride instance...')
    const ride = new Ride(rideData)
    console.log('Step 4: Ride instance created')
    
    console.log('Step 5: Validating...')
    const validationError = ride.validateSync()
    if (validationError) {
      console.log('Step 5: VALIDATION FAILED:', validationError.message)
      console.log('Validation details:', JSON.stringify(validationError.errors, null, 2))
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validationError.message,
          details: validationError.errors
        }
      }, { status: 400 })
    }
    console.log('Step 5: Validation passed')
    
    console.log('Step 6: Saving to database...')
    const savedRide = await ride.save()
    console.log('Step 6: SUCCESS! Ride saved with ID:', savedRide._id)
    
    // Step 7: Notify nearby drivers via Pusher
    console.log('Step 7: Notifying nearby drivers via Pusher...')
    try {
      await notifyNearbyDriversViaPusher({
        id: savedRide._id,
        rideId: savedRide.rideId,
        status: savedRide.status,
        pickup: savedRide.pickup,
        destination: savedRide.destination,
        pricing: savedRide.pricing,
        otp: savedRide.otp,
        pickupCode: savedRide.pickupCode,
        requestedAt: savedRide.requestedAt
      })
      console.log('Step 7: ✅ Nearby drivers notified via Pusher')
    } catch (notificationError) {
      console.error('Step 7: ❌ Pusher notification failed:', notificationError)
      // Don't fail the ride creation if notifications fail
    }
    
    return NextResponse.json({
      success: true,
      message: 'Ride created successfully',
      data: {
        id: savedRide._id,
        rideId: savedRide.rideId,
        status: savedRide.status,
        pickup: savedRide.pickup,
        destination: savedRide.destination,
        route: savedRide.route,
        carbonFootprint: savedRide.carbonFootprint,
        pricing: savedRide.pricing,
        requestedAt: savedRide.requestedAt,
        otp: savedRide.otp,
        pickupCode: savedRide.pickupCode
      }
    })
    
  } catch (error: any) {
    console.log('=== ERROR OCCURRED ===')
    console.log('Error type:', typeof error)
    console.log('Error name:', error.name)
    console.log('Error message:', error.message)
    console.log('Error stack:', error.stack)
    console.log('=== END ERROR ===')
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to create ride',
        details: error.message
      }
    }, { status: 500 })
  }
}