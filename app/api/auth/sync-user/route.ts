import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { User } from '@/lib/models'

export async function POST(request: NextRequest) {
  try {
    await connectDB()
    
    const body = await request.json()
    const { civicId, email, walletAddress, firstName, lastName, profilePicture } = body

    if (!civicId || !email) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'MISSING_REQUIRED_FIELDS', 
            message: 'Civic ID and email are required' 
          } 
        },
        { status: 400 }
      )
    }

    // Try to find existing user by civicId first
    let user = await User.findOne({ civicId })

    if (user) {
      // Update existing user with latest info from Civic
      user.email = email
      user.walletAddress = walletAddress
      if (firstName && firstName !== 'User') user.firstName = firstName
      if (lastName) user.lastName = lastName
      if (profilePicture) user.profilePicture = profilePicture
      
      // Update last active
      user.lastActive = new Date()
      
      await user.save()
      console.log('Updated existing user:', user.civicId)
    } else {
      // Create new user
      user = new User({
        civicId,
        email,
        walletAddress,
        firstName: firstName || 'User',
        lastName: lastName || '',
        profilePicture,
        isSponsored: false, // Default - can be updated later by admin
        totalRides: 0,
        totalCarbonSaved: 0,
        memberSince: new Date(),
        lastActive: new Date(),
        preferences: {
          notifications: true,
          shareLocation: true,
        },
        isActive: true,
        isVerified: false, // Will be verified through Civic auth process
      })

      await user.save()
      console.log('Created new user:', user.civicId)
    }

    // Return user data (without sensitive information)
    const userData = {
      id: user._id,
      civicId: user.civicId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      profilePicture: user.profilePicture,
      isSponsored: user.isSponsored,
      totalRides: user.totalRides,
      totalCarbonSaved: user.totalCarbonSaved,
      memberSince: user.memberSince,
      isVerified: user.isVerified,
      fullName: user.fullName,
      sponsorshipStatus: user.sponsorshipStatus,
    }

    return NextResponse.json({
      success: true,
      data: userData
    })

  } catch (error) {
    console.error('Sync user error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'DATABASE_ERROR', 
          message: 'Failed to sync user data' 
        } 
      },
      { status: 500 }
    )
  }
}
