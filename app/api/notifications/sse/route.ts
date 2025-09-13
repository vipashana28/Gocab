import { NextRequest } from 'next/server'

// Server-Sent Events endpoint for real-time notifications (Vercel-compatible)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const userType = searchParams.get('userType') // 'driver' or 'rider'

  if (!userId || !userType) {
    return new Response('Missing userId or userType', { status: 400 })
  }

  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      console.log(`📡 SSE connection started for ${userType} ${userId}`)
      
      // Send initial connection message
      const data = `data: ${JSON.stringify({
        type: 'connected',
        message: 'SSE connection established',
        timestamp: new Date().toISOString()
      })}\n\n`
      
      controller.enqueue(new TextEncoder().encode(data))
      
      // Keep connection alive with heartbeat
      const heartbeat = setInterval(() => {
        try {
          const heartbeatData = `data: ${JSON.stringify({
            type: 'heartbeat',
            timestamp: new Date().toISOString()
          })}\n\n`
          
          controller.enqueue(new TextEncoder().encode(heartbeatData))
        } catch (error) {
          console.log(`❌ SSE heartbeat failed for ${userType} ${userId}`)
          clearInterval(heartbeat)
          controller.close()
        }
      }, 30000) // 30 second heartbeat
      
      // Store connection for notifications (in production, use Redis or similar)
      if (!(global as any).sseConnections) {
        (global as any).sseConnections = new Map()
      }
      
      (global as any).sseConnections.set(userId, {
        controller,
        userType,
        heartbeat,
        timestamp: Date.now()
      })
      
      // Cleanup on close
      request.signal?.addEventListener('abort', () => {
        console.log(`🔌 SSE connection closed for ${userType} ${userId}`)
        clearInterval(heartbeat)
        ;(global as any).sseConnections?.delete(userId)
        controller.close()
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  })
}

// Helper function to send SSE notifications
export function sendSSENotification(userId: string, data: any) {
  if (!(global as any).sseConnections) return false
  
  const connection = (global as any).sseConnections.get(userId)
  if (!connection) return false
  
  try {
    const message = `data: ${JSON.stringify(data)}\n\n`
    connection.controller.enqueue(new TextEncoder().encode(message))
    return true
  } catch (error) {
    console.error(`❌ Failed to send SSE notification to ${userId}:`, error)
    ;(global as any).sseConnections.delete(userId)
    return false
  }
}
