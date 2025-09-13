import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models'

export async function PATCH(request: NextRequest) {
  try {
    await connectToDatabase()
    
    const body = await request.json()
    const { userId, phone } = body

    console.log('📞 Updating user phone number:', { userId, phone: phone ? '***' + phone.slice(-4) : 'null' })

    // Validate required fields
    if (!userId || !phone) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'User ID and phone number are required'
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

    // Check if phone number is already in use by another user
    const existingUser = await User.findOne({ 
      phone: cleanPhone,
      _id: { $ne: userId }
    })

    if (existingUser) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'PHONE_EXISTS',
          message: 'This phone number is already registered to another account'
        }
      }, { status: 400 })
    }

    // Update user's phone number
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { 
        phone: cleanPhone,
        lastActive: new Date()
      },
      { new: true }
    )

    if (!updatedUser) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      }, { status: 404 })
    }

    console.log('✅ Phone number updated successfully for user:', userId)

    return NextResponse.json({
      success: true,
      message: 'Phone number updated successfully',
      data: {
        userId: updatedUser._id,
        phone: updatedUser.phone,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName
      }
    })

  } catch (error: any) {
    console.error('❌ Error updating phone number:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update phone number',
        details: error.message
      }
    }, { status: 500 })
  }
}
