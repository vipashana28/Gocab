import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models'

export async function PATCH(request: NextRequest) {
  try {
    await connectToDatabase()
    
    const body = await request.json()
    const { userId, phone, vehicleName, licensePlate, vehicleType } = body

    console.log('📞 Updating driver details:', { 
      userId, 
      phone: phone ? '***' + phone.slice(-4) : 'null',
      vehicleName: vehicleName || 'null',
      licensePlate: licensePlate ? '***' + licensePlate.slice(-2) : 'null',
      vehicleType: vehicleType || 'null'
    })

    // Validate required fields
    if (!userId || !phone || !vehicleName || !licensePlate || !vehicleType) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'User ID, phone number, vehicle name, license plate, and vehicle type are required'
        }
      }, { status: 400 })
    }

    // Validate phone number format
    const phoneRegex = /^[\+]?[1-9][\d]{7,15}$/
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '')
    
    if (!phoneRegex.test(cleanPhone)) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_PHONE',
          message: 'Invalid phone number format'
        }
      }, { status: 400 })
    }

    // Validate vehicle details
    if (vehicleName.trim().length < 2 || vehicleName.trim().length > 50) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_VEHICLE_NAME',
          message: 'Vehicle name must be between 2 and 50 characters'
        }
      }, { status: 400 })
    }

    const plateRegex = /^[A-Z0-9\s\-]{6,10}$/i
    if (!plateRegex.test(licensePlate.trim())) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_LICENSE_PLATE',
          message: 'License plate must be 6-10 characters (letters and numbers only)'
        }
      }, { status: 400 })
    }

    if (!['4-wheeler', '6-wheeler'].includes(vehicleType)) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_VEHICLE_TYPE',
          message: 'Vehicle type must be either 4-wheeler or 6-wheeler'
        }
      }, { status: 400 })
    }

    // Check if phone number is already in use by a different user (different email)
    // Allow same email+phone combination to register multiple times
    const existingUser = await User.findOne({ 
      phone: cleanPhone,
      _id: { $ne: userId }
    })

    if (existingUser) {
      // Get current user's email to compare
      const currentUser = await User.findById(userId)
      
      if (currentUser && existingUser.email !== currentUser.email) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'PHONE_EXISTS',
            message: 'This phone number is already registered to a different account'
          }
        }, { status: 400 })
      }
      // If emails match, allow the update (same person registering again)
    }

    // First, get the current user to check if driverProfile exists
    const currentUser = await User.findById(userId)
    if (!currentUser) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      }, { status: 404 })
    }

    // Prepare update data
    const updateData: any = {
      phone: cleanPhone,
      vehicleName: vehicleName.trim(),
      licensePlate: licensePlate.trim().toUpperCase(),
      vehicleType: vehicleType,
      lastActive: new Date()
    }

    // Initialize or update driverProfile
    if (!currentUser.driverProfile) {
      // Create new driverProfile
      updateData.driverProfile = {
        isOnline: false,
        vehicleInfo: vehicleName.trim(),
        licensePlate: licensePlate.trim().toUpperCase(),
        rating: 4.8
      }
    } else {
      // Update existing driverProfile vehicle info
      updateData['driverProfile.vehicleInfo'] = vehicleName.trim()
      updateData['driverProfile.licensePlate'] = licensePlate.trim().toUpperCase()
    }

    // Update user's driver details
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    )

    if (!updatedUser) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update user details'
        }
      }, { status: 500 })
    }

    console.log('✅ Driver details updated successfully for user:', userId)

    return NextResponse.json({
      success: true,
      message: 'Driver details updated successfully',
      data: {
        userId: updatedUser._id,
        phone: updatedUser.phone,
        vehicleName: updatedUser.vehicleName,
        licensePlate: updatedUser.licensePlate,
        vehicleType: updatedUser.vehicleType,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        driverProfile: updatedUser.driverProfile ? {
          isOnline: updatedUser.driverProfile.isOnline,
          vehicleInfo: updatedUser.driverProfile.vehicleInfo,
          licensePlate: updatedUser.driverProfile.licensePlate,
          rating: updatedUser.driverProfile.rating
        } : null
      }
    })

  } catch (error: any) {
    console.error('❌ Error updating driver details:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update driver details',
        details: error.message
      }
    }, { status: 500 })
  }
}
