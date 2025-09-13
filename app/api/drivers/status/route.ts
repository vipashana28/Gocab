import { NextRequest, NextResponse } from 'next/server'
import { updateDriverStatusViaPusher } from '@/lib/services/pusher'

export async function POST(request: NextRequest) {
  try {
    const { driverId, isOnline } = await request.json()
    
    if (!driverId || typeof isOnline !== 'boolean') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing driverId or isOnline status' 
        },
        { status: 400 }
      )
    }
    
    await updateDriverStatusViaPusher(driverId, isOnline)
    
    return NextResponse.json({
      success: true,
      message: `Driver ${isOnline ? 'online' : 'offline'} status updated`
    })
    
  } catch (error: any) {
    console.error('❌ Error updating driver status:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update driver status',
        details: error.message
      }
    }, { status: 500 })
  }
}
