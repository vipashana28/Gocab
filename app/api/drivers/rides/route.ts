import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { Ride, User } from '@/lib/models'

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase()
    
    const { searchParams } = new URL(request.url)
    const driverId = searchParams.get('driverId')

    if (!driverId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Driver ID is required' 
        },
        { status: 400 }
      )
    }

    // Get driver's current location
    const driver = await User.findById(driverId)
    if (!driver || !driver.driverProfile?.currentLocation) {
      return NextResponse.json({
        success: true,
        data: [],
        message: 'No location data available'
      })
    }

    const driverLocation = driver.driverProfile.currentLocation.coordinates // [lng, lat]

    // Find nearby ride requests (within 5km radius)
    const nearbyRides = await Ride.find({
      status: 'requested', // Only unassigned rides
      'pickup.coordinates': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: driverLocation // [lng, lat]
          },
          $maxDistance: 5000 // 5km in meters
        }
      }
    })
    .populate('userId', 'firstName lastName')
    .sort({ requestedAt: 1 }) // Oldest first
    .limit(5) // Limit to 5 nearest requests

    // Calculate distance to pickup for each ride
    const rideRequests = nearbyRides.map(ride => {
      const pickupLng = ride.pickup.coordinates.longitude
      const pickupLat = ride.pickup.coordinates.latitude
      
      // Simple distance calculation (haversine formula simplified)
      const R = 6371 // Earth's radius in km
      const dLat = (pickupLat - driverLocation[1]) * Math.PI / 180
      const dLng = (pickupLng - driverLocation[0]) * Math.PI / 180
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(driverLocation[1] * Math.PI / 180) * Math.cos(pickupLat * Math.PI / 180) *
                Math.sin(dLng/2) * Math.sin(dLng/2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
      const distanceToPickup = R * c

      return {
        id: ride._id.toString(),
        rideId: ride.rideId,
        otp: ride.otp,
        pickupAddress: ride.pickup.address,
        destinationAddress: ride.destination.address,
        pickupCoordinates: ride.pickup.coordinates,
        estimatedFare: ride.pricing?.totalEstimated || 0,
        distanceToPickup,
        passengerName: ride.userId ? `${ride.userId.firstName} ${ride.userId.lastName}` : 'Passenger',
        requestedAt: ride.requestedAt
      }
    })

    return NextResponse.json({
      success: true,
      data: rideRequests,
      meta: {
        driverLocation: {
          latitude: driverLocation[1],
          longitude: driverLocation[0]
        },
        totalRequests: rideRequests.length
      }
    })

  } catch (error) {
    console.error('Get ride requests error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch ride requests' 
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase()
    
    const body = await request.json()
    const { driverId, rideId, action } = body

    // Validate required fields
    if (!driverId || !rideId || !action) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Driver ID, ride ID, and action are required' 
        },
        { status: 400 }
      )
    }

    if (!['accept', 'decline'].includes(action)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Action must be either "accept" or "decline"' 
        },
        { status: 400 }
      )
    }

    // Get the ride
    const ride = await Ride.findById(rideId)
    if (!ride) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Ride not found' 
        },
        { status: 404 }
      )
    }

    if (ride.status !== 'requested') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Ride is no longer available' 
        },
        { status: 400 }
      )
    }

    if (action === 'accept') {
      // Get driver details
      const driver = await User.findById(driverId)
      if (!driver) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Driver not found' 
          },
          { status: 404 }
        )
      }

      // Update ride with real driver assignment
      ride.status = 'matched'
      ride.matchedAt = new Date()
      ride.driverContact = {
        phone: driver.phone || '+1 (555) 000-0000',
        name: `${driver.firstName} ${driver.lastName}`,
        vehicleInfo: driver.driverProfile?.vehicleInfo || '2023 Toyota Camry - Blue',
        licensePlate: driver.driverProfile?.licensePlate || 'GC-' + Math.floor(Math.random() * 999).toString().padStart(3, '0'),
        photo: driver.profilePicture || `https://i.pravatar.cc/150?u=${driver.email}`,
        rating: driver.driverProfile?.rating || 4.8
      }
      
      // Set driver location from their current location
      if (driver.driverProfile?.currentLocation) {
        const coords = driver.driverProfile.currentLocation.coordinates // [lng, lat]
        ride.driverLocation = {
          coordinates: {
            latitude: coords[1],
            longitude: coords[0]
          },
          lastUpdated: new Date()
        }
      }
      
      // Set estimated arrival (2-8 minutes)
      const estimatedArrivalMinutes = Math.floor(Math.random() * 6) + 2
      ride.estimatedArrival = `${estimatedArrivalMinutes} minutes`
      ride.statusDisplay = 'Driver En Route'

      await ride.save()

      console.log(`Driver ${driverId} accepted ride ${rideId}`)

      return NextResponse.json({
        success: true,
        message: 'Ride accepted successfully',
        data: {
          rideId: ride.rideId,
          otp: ride.otp,
          status: ride.status,
          driverContact: ride.driverContact,
          estimatedArrival: ride.estimatedArrival
        }
      })

    } else if (action === 'decline') {
      // For decline, we just log it - the ride remains available for other drivers
      console.log(`Driver ${driverId} declined ride ${rideId}`)

      return NextResponse.json({
        success: true,
        message: 'Ride declined',
        data: { rideId, action: 'declined' }
      })
    }

  } catch (error) {
    console.error('Driver ride action error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process ride action' 
      },
      { status: 500 }
    )
  }
}
