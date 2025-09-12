import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'

export async function GET(request: NextRequest) {
  try {
    // Test MongoDB connection
    await connectToDatabase()
    
    return NextResponse.json({
      status: 'OK',
      message: 'GoCab API is running',
      database: 'Connected',
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('Health check failed:', error)
    
    return NextResponse.json({
      status: 'ERROR',
      message: 'Database connection failed',
      error: error?.message || 'Unknown error',
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
