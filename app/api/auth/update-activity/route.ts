import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { User } from '@/lib/models'
import mongoose from 'mongoose'

export async function POST(request: NextRequest) {
  try {
    await connectDB()
    
    const body = await request.json()
    const { userId } = body

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

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
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

    const user = await User.findById(userId)
    
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

    // Update last active timestamp
    user.lastActive = new Date()
    await user.save()

    return NextResponse.json({
      success: true,
      data: {
        userId: user._id,
        lastActive: user.lastActive
      }
    })

  } catch (error) {
    console.error('Update activity error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'DATABASE_ERROR', 
          message: 'Failed to update user activity' 
        } 
      },
      { status: 500 }
    )
  }
}
