import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models'

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase()
    
    const body = await request.json()
    const { googleId, email, firstName, lastName, profilePicture } = body

    if (!googleId || !email) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'MISSING_REQUIRED_FIELDS', 
            message: 'Google ID and email are required' 
          } 
        },
        { status: 400 }
      )
    }

    // Try to find existing user by googleId first
    let user = await User.findOne({ googleId })

    if (user) {
      // Update existing user with latest info from Google
      user.email = email
      if (firstName && firstName !== 'User') user.firstName = firstName
      if (lastName) user.lastName = lastName
      if (profilePicture) user.profilePicture = profilePicture
      
      // Update last active
      user.lastActive = new Date()
      
      await user.save()
      console.log('Updated existing user:', user.googleId)
    } else {
      // Create new user
      user = new User({
        googleId,
        email,
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
        isVerified: false, // Will be verified through Google auth process
      })

      await user.save()
      console.log('Created new user:', user.googleId)
    }

    // Return user data (without sensitive information)
    const userData = {
      id: user._id,
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
