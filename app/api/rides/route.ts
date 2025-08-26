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

    // Calculate distance (simplified - in production use Google Maps Distance Matrix API)
    const distance = calculateDistance(
      pickup.coordinates.latitude,
      pickup.coordinates.longitude,
      destination.coordinates.latitude,
      destination.coordinates.longitude
    )

    // Estimate duration (simplified - assume 30 mph average)
    const estimatedDuration = Math.ceil((distance / 30) * 60) // minutes

    // Calculate estimated fare (base fare + distance fee)
    const baseFare = 3.50
    const distanceFee = distance * 2.25 // $2.25 per mile
    const timeFee = estimatedDuration * 0.15 // $0.15 per minute
    const estimatedFare = baseFare + distanceFee + timeFee

    // Calculate carbon footprint (simplified - 0.404 kg CO2 per mile for average car)
    const carbonSaved = distance * 0.404 * 0.6 // Assuming 40% reduction with rideshare

    // Generate unique ride ID and pickup code
    const rideId = 'RIDE_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6).toUpperCase()
    const pickupCode = Math.floor(100000 + Math.random() * 900000).toString()

    // Create new ride
    const ride = new Ride({
      rideId,
      pickupCode,
      userId,
      pickup,
      destination,
      route: {
        distance,
        estimatedDuration,
        estimatedFare
      },
      status: 'requested',
      requestedAt: new Date(),
      carbonFootprint: {
        estimatedSaved: carbonSaved,
        comparisonMethod: 'vs private car',
        calculationMethod: 'EPA standard'
      },
      pricing: {
        baseFare,
        distanceFee,
        timeFee,
        totalEstimated: estimatedFare,
        currency: 'USD',
        isSponsored: user.isSponsored
      },
      userNotes,
      specialRequests,
      platform: 'web'
    })

    await ride.save()

    // Try to match with available drivers
    const availableDrivers = await Driver.find({
      isOnline: true,
      isAvailable: true,
      status: 'active',
      isPilotApproved: true,
      backgroundCheckStatus: 'approved',
      'currentLocation.coordinates': {
        $near: {
          $geometry: { 
            type: 'Point', 
            coordinates: [pickup.coordinates.longitude, pickup.coordinates.latitude] 
          },
          $maxDistance: 5000 // 5km radius
        }
      }
    }).limit(5)

    if (availableDrivers.length > 0) {
      // For now, assign to first available driver
      // TODO: Implement proper matching algorithm
      const assignedDriver = availableDrivers[0]
      
      ride.driverId = assignedDriver._id
      ride.status = 'matched'
      ride.matchedAt = new Date()
      ride.driverContact = {
        phone: assignedDriver.phone,
        name: assignedDriver.fullName,
        vehicleInfo: assignedDriver.vehicleDisplayName,
        licensePlate: assignedDriver.vehicle.licensePlate
      }
      
      // Update driver availability
      assignedDriver.isAvailable = false
      await assignedDriver.save()
      await ride.save()
    }

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
        requestedAt: ride.requestedAt,
        matchedAt: ride.matchedAt
      },
      message: availableDrivers.length > 0 ? 'Ride created and driver assigned' : 'Ride created, searching for driver'
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

// Helper function to calculate distance between two points (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959 // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  const distance = R * c
  return Math.round(distance * 100) / 100 // Round to 2 decimal places
}
