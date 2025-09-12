import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { Ride, Driver, User } from '@/lib/models'
import mongoose from 'mongoose'

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase()
    
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const driverId = searchParams.get('driverId')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '20')

    let query: any = {}
    
    // Filter by user (allow demo user)
    if (userId) {
      const isDemoUser = userId === '507f1f77bcf86cd799439011'
      if (!isDemoUser && !mongoose.Types.ObjectId.isValid(userId)) {
        return NextResponse.json(
          { 
            success: false, 
            error: { 
              code: 'INVALID_USER_ID', 
              message: 'Invalid user ID format' 
            } 
          },
          { status: 400 }
        )
      }
      query.userId = userId
    }
    
    // Filter by driver
    if (driverId) {
      if (!mongoose.Types.ObjectId.isValid(driverId)) {
        return NextResponse.json(
          { 
            success: false, 
            error: { 
              code: 'INVALID_DRIVER_ID', 
              message: 'Invalid driver ID format' 
            } 
          },
          { status: 400 }
        )
      }
      query.driverId = driverId
    }
    
    // Filter by status
    if (status) {
      query.status = status
    }

    const rides = await Ride.find(query)
      .populate('userId', 'firstName lastName email phone')
      .populate('driverId', 'firstName lastName phone vehicle')
      .sort({ requestedAt: -1 })
      .limit(limit)

    return NextResponse.json({
      success: true,
      data: rides,
      meta: {
        total: rides.length,
        limit,
        query
      }
    })

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
  try {
    console.log('Creating new ride request...')
    
    await connectToDatabase()
    console.log('Database connected for ride creation')
    
    const body = await request.json()
    console.log('Ride request data:', {
      hasUserId: !!body.userId,
      hasPickup: !!body.pickup,
      hasDestination: !!body.destination,
      pickupAddress: body.pickup?.address,
      destinationAddress: body.destination?.address
    })
    
    const {
      userId,
      pickup,
      destination,
      userNotes,
      specialRequests
    } = body

    // Validate required fields
    if (!userId || !pickup || !destination) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'MISSING_REQUIRED_FIELDS', 
            message: 'User ID, pickup, and destination are required' 
          } 
        },
        { status: 400 }
      )
    }

    // Validate pickup and destination structure
    if (!pickup.address || !pickup.coordinates || 
        !destination.address || !destination.coordinates) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'INVALID_LOCATION_DATA', 
            message: 'Pickup and destination must have address and coordinates' 
          } 
        },
        { status: 400 }
      )
    }

    // Validate user exists (skip for demo user)
    const isDemoUser = userId === '507f1f77bcf86cd799439011'
    let user = null
    
    if (!isDemoUser) {
      try {
        // Try to find user by MongoDB _id first
        if (mongoose.Types.ObjectId.isValid(userId)) {
          user = await User.findById(userId)
        }
        
        // If not found, try to find by googleId (fallback)
        if (!user) {
          user = await User.findOne({ googleId: userId })
        }
        
        // If still not found, try by email (last fallback)
        if (!user) {
          user = await User.findOne({ email: userId })
        }
        
        if (!user) {
          console.log(`User not found with identifier: ${userId}`)
          return NextResponse.json(
            { 
              success: false, 
              error: { 
                code: 'USER_NOT_FOUND', 
                message: 'User not found. Please sign in again.' 
              } 
            },
            { status: 404 }
          )
        }
        
        console.log(`Found user: ${user.email} (${user._id})`)
      } catch (dbError: any) {
        console.error('Database error finding user:', dbError)
        return NextResponse.json(
          { 
            success: false, 
            error: { 
              code: 'DATABASE_ERROR', 
              message: 'Database error finding user' 
            } 
          },
          { status: 500 }
        )
      }
    }

    // Check if user has any active rides (use the actual user's _id from database)
    const actualUserId = user?._id || userId
    const activeRide = await Ride.findOne({
      userId: actualUserId,
      status: { $in: ['requested', 'matched', 'driver_en_route', 'arrived', 'in_progress'] }
    })
    
    if (activeRide) {
      // Populate the active ride with driver info for better error response
      await activeRide.populate('driverId', 'firstName lastName phone vehicle')
      
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'ACTIVE_RIDE_EXISTS', 
            message: 'User already has an active ride',
            activeRide: {
              id: activeRide._id,
              rideId: activeRide.rideId,
              pickupCode: activeRide.pickupCode,
              status: activeRide.status,
              statusDisplay: activeRide.statusDisplay || 'Active Ride',
              pickup: activeRide.pickup,
              destination: activeRide.destination,
              driverContact: activeRide.driverContact,
              driverLocation: activeRide.driverLocation,
              pricing: activeRide.pricing,
              carbonFootprint: activeRide.carbonFootprint,
              requestedAt: activeRide.requestedAt,
              estimatedArrival: activeRide.estimatedArrival
            }
          } 
        },
        { status: 400 }
      )
    }

    // Calculate distance and duration using our Google Directions API
    const directionsResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/directions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        origin: {
          latitude: pickup.coordinates.latitude,
          longitude: pickup.coordinates.longitude
        },
        destination: {
          latitude: destination.coordinates.latitude,
          longitude: destination.coordinates.longitude
        },
        travelMode: 'DRIVING',
        avoidHighways: false,
        avoidTolls: false
      })
    })

    if (!directionsResponse.ok) {
      return NextResponse.json(
        { success: false, error: 'Could not calculate a valid route for the given locations.' },
        { status: 400 }
      )
    }

    const routeData = await directionsResponse.json()
    
    if (!routeData.success || !routeData.data) {
      return NextResponse.json(
        { success: false, error: 'Could not calculate a valid route for the given locations.' },
        { status: 400 }
      )
    }

    // Extract the correct distance and duration values
    const distanceKm = routeData.data.distance?.km
    const durationMinutes = routeData.data.durationInTraffic?.minutes || routeData.data.duration?.minutes
    
    // Add debugging and validation
    console.log('Route calculation data:', { 
      distanceKm, 
      durationMinutes, 
      rawData: routeData.data 
    })
    
    // Validate distance and duration
    if (!distanceKm || !durationMinutes || isNaN(distanceKm) || isNaN(durationMinutes)) {
      console.error('Invalid distance or duration:', { distanceKm, durationMinutes })
      return NextResponse.json(
        { success: false, error: 'Invalid route calculation data received.' },
        { status: 400 }
      )
    }
    
    const distanceMiles = distanceKm * 0.621371 // Convert km to miles
    const estimatedDurationMinutes = Math.round(durationMinutes)

    // Calculate estimated fare (base fare + distance fee + time fee)
    const baseFare = 3.50
    const distanceFee = distanceMiles * 2.25 // $2.25 per mile
    const timeFee = estimatedDurationMinutes * 0.15 // $0.15 per minute
    const estimatedFare = baseFare + distanceFee + timeFee
    
    // Validate fare calculation
    if (isNaN(estimatedFare)) {
      console.error('Invalid fare calculation:', { baseFare, distanceFee, timeFee, estimatedFare })
      return NextResponse.json(
        { success: false, error: 'Failed to calculate fare.' },
        { status: 400 }
      )
    }
    
    console.log('Fare calculation:', { baseFare, distanceFee, timeFee, estimatedFare })

    // Calculate carbon footprint (using km for more accurate EPA calculations)
    const carbonSaved = distanceKm * 0.21 * 0.6 // 0.21 kg CO2/km for avg car * 60% reduction

    // Generate unique ride ID, pickup code, and OTP
    const rideId =
      'RIDE_' +
      Date.now() +
      '_' +
      Math.random().toString(36).substr(2, 6).toUpperCase()
    const pickupCode = Math.floor(100000 + Math.random() * 900000).toString()
    const otp = Math.floor(1000 + Math.random() * 9000).toString() // 4-digit OTP

    // Create new ride
    const ride = new Ride({
      rideId,
      pickupCode,
      otp,
      userId: actualUserId,
      pickup,
      destination,
      route: {
        distance: distanceMiles,
        estimatedDuration: estimatedDurationMinutes,
        estimatedFare,
      },
      status: 'requested',
      requestedAt: new Date(),
      carbonFootprint: {
        estimatedSaved: carbonSaved,
        comparisonMethod: 'vs private car',
        calculationMethod: 'EPA standard'
      },
      pricing: {
        baseFare: Math.round(baseFare * 100) / 100,
        distanceFee: Math.round(distanceFee * 100) / 100,
        timeFee: Math.round(timeFee * 100) / 100,
        totalEstimated: Math.round(estimatedFare * 100) / 100,
        currency: 'USD',
        isSponsored: user?.isSponsored || false
      },
      userNotes,
      specialRequests,
      platform: 'web'
    })

    console.log('Attempting to save ride to database...')
    console.log('Ride data being saved:', JSON.stringify({
      rideId: ride.rideId,
      userId: ride.userId,
      status: ride.status,
      pickup: ride.pickup,
      destination: ride.destination,
      route: ride.route,
      pricing: ride.pricing
    }, null, 2))
    
    await ride.save()
    console.log('Ride saved successfully to database')

    // Find available drivers near the pickup location
    let nearbyDrivers = []
    try {
      nearbyDrivers = await User.find({
        'driverProfile.isOnline': true,
        'driverProfile.currentLocation.coordinates': { $exists: true, $ne: null },
        'driverProfile.currentLocation.type': 'Point'
      }).limit(10) // Get up to 10 online drivers
      
      // If we have drivers with location data, filter by distance
      if (nearbyDrivers.length > 0) {
        nearbyDrivers = await User.find({
          'driverProfile.isOnline': true,
          'driverProfile.currentLocation': {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: [pickup.coordinates.longitude, pickup.coordinates.latitude] // [lng, lat]
              },
              $maxDistance: 10000 // 10km radius
            }
          }
        }).limit(10)
      }
    } catch (geoError: any) {
      console.log('Geospatial query failed, falling back to online drivers:', geoError.message)
      // Fallback to just finding online drivers without location filtering
      nearbyDrivers = await User.find({
        'driverProfile.isOnline': true
      }).limit(10)
    }
    
    if (nearbyDrivers.length === 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NO_DRIVERS_AVAILABLE',
          message: 'No drivers around! Come back after sometime soon!',
          userMessage: 'No drivers around! Come back after sometime soon!'
        }
      }, { status: 503 }) // Service Unavailable
    }

    // Broadcast ride request to all nearby drivers
    // Note: In production, this would use WebSocket or push notifications
    // For now, drivers will poll the API to get ride requests
    console.log(`Broadcasting ride ${ride.rideId} to ${nearbyDrivers.length} nearby drivers`)
    
    // Update ride status to searching for driver
    ride.status = 'requested'
    ride.statusDisplay = 'Finding Driver...'
    await ride.save()
    
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
        route: ride.route,
        carbonFootprint: ride.carbonFootprint,
        pricing: ride.pricing,
        requestedAt: ride.requestedAt,
        availableDrivers: nearbyDrivers.length
      },
      message: 'Ride request sent to nearby drivers'
    })

  } catch (error: any) {
    console.error('Create ride error:', error)
    console.error('Detailed error:', {
      name: error?.name,
      message: error?.message,
      code: error?.code,
      stack: error?.stack?.substring(0, 500)
    })
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'DATABASE_ERROR', 
          message: 'Failed to create ride' 
        } 
      },
      { status: 500 }
    )
  }
}
