import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'OK',
    message: 'GoCab API is running',
    timestamp: new Date().toISOString()
  })
}
