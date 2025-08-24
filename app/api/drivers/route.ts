import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { Driver } from '@/lib/models'

export async function GET(request: NextRequest) {
  try {
    await connectDB()
    
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const available = searchParams.get('available')
    const latitude = searchParams.get('lat')
    const longitude = searchParams.get('lng')
    const maxDistance = parseInt(searchParams.get('maxDistance') || '5000') // 5km default

    let query: any = {}
    
    // Filter by status
    if (status) {
      query.status = status
    }
    
    // Filter by availability
    if (available === 'true') {
      query.isOnline = true
      query.isAvailable = true
      query.status = 'active'
      query.isPilotApproved = true
      query.backgroundCheckStatus = 'approved'
    }

    let drivers
    
    // Location-based search
    if (latitude && longitude) {
      const lat = parseFloat(latitude)
      const lng = parseFloat(longitude)
      
      drivers = await Driver.find({
        ...query,
        'currentLocation.coordinates': {
          $near: {
            $geometry: { type: 'Point', coordinates: [lng, lat] },
            $maxDistance: maxDistance
          }
        }
      }).select('-__v').limit(20)
    } else {
      // General search
      drivers = await Driver.find(query).select('-__v').limit(50)
    }

    return NextResponse.json({
      success: true,
      data: drivers,
      meta: {
        total: drivers.length,
        query: query
      }
    })

  } catch (error) {
    console.error('Get drivers error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'DATABASE_ERROR', 
          message: 'Failed to fetch drivers' 
        } 
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB()
    
    const body = await request.json()
    const {
      firstName,
      lastName,
      email,
      phone,
      licenseNumber,
      licenseExpiry,
      vehicle,
      isPilotApproved = false
    } = body

    // Validate required fields
    if (!firstName || !lastName || !email || !phone || !licenseNumber || !licenseExpiry || !vehicle) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'MISSING_REQUIRED_FIELDS', 
            message: 'Missing required driver information' 
          } 
        },
        { status: 400 }
      )
    }

    // Check if driver already exists
    const existingDriver = await Driver.findOne({ 
      $or: [{ email }, { licenseNumber }, { phone }] 
    })
    
    if (existingDriver) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'DRIVER_EXISTS', 
            message: 'Driver with this email, license, or phone already exists' 
          } 
        },
        { status: 400 }
      )
    }

    // Generate unique driver ID
    const driverId = 'DRV_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6).toUpperCase()

    // Create new driver
    const driver = new Driver({
      driverId,
      firstName,
      lastName,
      email,
      phone,
      licenseNumber,
      licenseExpiry: new Date(licenseExpiry),
      vehicle,
      isPilotApproved,
      pilotStartDate: isPilotApproved ? new Date() : new Date(),
      status: isPilotApproved ? 'active' : 'pending',
      backgroundCheckStatus: 'pending',
      isOnline: false,
      isAvailable: false,
      totalRides: 0,
      totalDistance: 0,
      averageRating: 5.0,
      totalEarnings: 0,
      carbonSavedForRiders: 0,
      joinDate: new Date(),
      lastActive: new Date(),
      // Default working hours (can be updated later)
      workingHours: {
        monday: { start: '09:00', end: '17:00', active: true },
        tuesday: { start: '09:00', end: '17:00', active: true },
        wednesday: { start: '09:00', end: '17:00', active: true },
        thursday: { start: '09:00', end: '17:00', active: true },
        friday: { start: '09:00', end: '17:00', active: true },
        saturday: { start: '09:00', end: '17:00', active: false },
        sunday: { start: '09:00', end: '17:00', active: false }
      }
    })

    await driver.save()

    // Return driver data (without sensitive information)
    const driverData = {
      id: driver._id,
      driverId: driver.driverId,
      firstName: driver.firstName,
      lastName: driver.lastName,
      email: driver.email,
      phone: driver.phone,
      vehicle: driver.vehicle,
      status: driver.status,
      isPilotApproved: driver.isPilotApproved,
      backgroundCheckStatus: driver.backgroundCheckStatus,
      isOnline: driver.isOnline,
      isAvailable: driver.isAvailable,
      joinDate: driver.joinDate,
      fullName: driver.fullName,
      vehicleDisplayName: driver.vehicleDisplayName,
      canAcceptRides: driver.canAcceptRides
    }

    return NextResponse.json({
      success: true,
      data: driverData,
      message: 'Driver created successfully'
    })

  } catch (error) {
    console.error('Create driver error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'DATABASE_ERROR', 
          message: 'Failed to create driver' 
        } 
      },
      { status: 500 }
    )
  }
}
