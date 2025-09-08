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

  } catch (error) {
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
    await connectToDatabase()
    
    const body = await request.json()
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
      user = await User.findById(userId)
      if (!user) {
        return NextResponse.json(
          { 
            success: false, 
            error: { 
              code: 'USER_NOT_FOUND', 
              message: 'User not found' 
            } 
          },
          { status: 404 }
        )
      }
    }

    // Check if user has any active rides
    const activeRide = await Ride.findOne({
      userId,
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
    console.log('📊 Route calculation data:', { 
      distanceKm, 
      durationMinutes, 
      rawData: routeData.data 
    })
    
    // Validate distance and duration
    if (!distanceKm || !durationMinutes || isNaN(distanceKm) || isNaN(durationMinutes)) {
      console.error('❌ Invalid distance or duration:', { distanceKm, durationMinutes })
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
      console.error('❌ Invalid fare calculation:', { baseFare, distanceFee, timeFee, estimatedFare })
      return NextResponse.json(
        { success: false, error: 'Failed to calculate fare.' },
        { status: 400 }
      )
    }
    
    console.log('💰 Fare calculation:', { baseFare, distanceFee, timeFee, estimatedFare })

    // Calculate carbon footprint (using km for more accurate EPA calculations)
    const carbonSaved = distanceKm * 0.21 * 0.6 // 0.21 kg CO2/km for avg car * 60% reduction

    // Generate unique ride ID and pickup code
    const rideId =
      'RIDE_' +
      Date.now() +
      '_' +
      Math.random().toString(36).substr(2, 6).toUpperCase()
    const pickupCode = Math.floor(100000 + Math.random() * 900000).toString()

    // Create new ride
    const ride = new Ride({
      rideId,
      pickupCode,
      userId,
      pickup,
      destination,
      route: {
        distance: distanceMiles,
        distanceKm: distanceKm,
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

    await ride.save()

    // For demo purposes, we'll simulate a driver assignment with dummy data
    // In production, this would query real driver database
    const dummyDrivers = [
      {
        name: 'Alex Johnson',
        phone: '+1 (555) 123-4567',
        vehicleInfo: '2022 Toyota Camry - Blue',
        licensePlate: 'GC-001',
        photo: 'https://i.pravatar.cc/150?u=alex-johnson',
        rating: 4.9
      },
      {
        name: 'Maria Rodriguez',
        phone: '+1 (555) 234-5678',
        vehicleInfo: '2023 Honda Civic - White',
        licensePlate: 'GC-002',
        photo: 'https://i.pravatar.cc/150?u=maria-rodriguez',
        rating: 4.8
      },
      {
        name: 'David Chen',
        phone: '+1 (555) 345-6789',
        vehicleInfo: '2021 Nissan Altima - Gray',
        licensePlate: 'GC-003',
        photo: 'https://i.pravatar.cc/150?u=david-chen',
        rating: 4.7
      }
    ]

    // Randomly assign a dummy driver (for demo)
    const assignedDriver = dummyDrivers[Math.floor(Math.random() * dummyDrivers.length)]
    
    // Generate dummy driver location near pickup
    const driverLocation = {
      latitude: pickup.coordinates.latitude + (Math.random() - 0.5) * 0.01, // Within ~1km
      longitude: pickup.coordinates.longitude + (Math.random() - 0.5) * 0.01
    }
    
    // Estimate arrival time (2-8 minutes)
    const estimatedArrivalMinutes = Math.floor(Math.random() * 6) + 2
    
    // Update ride with driver assignment
    ride.status = 'matched'
    ride.matchedAt = new Date()
    ride.driverContact = {
      phone: assignedDriver.phone,
      name: assignedDriver.name,
      vehicleInfo: assignedDriver.vehicleInfo,
      licensePlate: assignedDriver.licensePlate,
      photo: assignedDriver.photo,
      rating: assignedDriver.rating
    }
    ride.driverLocation = {
      coordinates: driverLocation,
      lastUpdated: new Date()
    }
    ride.estimatedArrival = `${estimatedArrivalMinutes} minutes`
    ride.statusDisplay = 'Driver Found'
    
    await ride.save()

    // Populate driver info if matched
    await ride.populate('driverId', 'firstName lastName phone vehicle')
    
    return NextResponse.json({
      success: true,
      data: {
        id: ride._id,
        rideId: ride.rideId,
        pickupCode: ride.pickupCode,
        status: ride.status,
        statusDisplay: ride.statusDisplay,
        pickup: ride.pickup,
        destination: ride.destination,
        route: ride.route,
        carbonFootprint: ride.carbonFootprint,
        pricing: ride.pricing,
        driverContact: ride.driverContact,
        driverLocation: ride.driverLocation,
        estimatedArrival: ride.estimatedArrival,
        requestedAt: ride.requestedAt,
        matchedAt: ride.matchedAt
      },
      message: 'Ride created and driver assigned'
    })

  } catch (error) {
    console.error('Create ride error:', error)
    
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
