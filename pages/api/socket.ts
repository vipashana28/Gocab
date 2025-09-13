import { NextApiRequest, NextApiResponse } from 'next'
import { Server as ServerIO } from 'socket.io'
import { Server as NetServer } from 'http'
import { connectToDatabase } from '@/lib/mongodb'

import { Driver, User } from '@/lib/models'

export interface ServerToClientEvents {
  'ride:new': (rideData: any) => void
  'ride:status_update': (rideData: any) => void
  'driver:location_update': (locationData: any) => void
  'notification:sound': () => void
}

export interface ClientToServerEvents {
  'driver:join': (driverId: string) => void
  'driver:leave': (driverId: string) => void
  'rider:join': (riderId: string) => void
  'rider:leave': (riderId: string) => void
  'driver:update_location': (data: { driverId: string, coordinates: { latitude: number, longitude: number } }) => void
}

export interface InterServerEvents {
  ping: () => void
}

export interface SocketData {
  userId: string
  userType: 'driver' | 'rider'
  driverId?: string
  riderId?: string
}

type NextApiResponseServerIO = NextApiResponse & {
  socket: {
    server: NetServer & {
      io: ServerIO<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
    }
  }
}

// Helper function to calculate distance between two coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959 // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  
  return R * c // Distance in miles
}

export default async function SocketHandler(req: NextApiRequest, res: NextApiResponseServerIO) {
  if (res.socket.server.io) {
    console.log('⚡ Socket.IO already running')
  } else {
    console.log('⚡ Socket.IO starting...')
    
    const io = new ServerIO(res.socket.server, {
      path: '/api/socket',
      addTrailingSlash: false,
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      },
      // Vercel-friendly configuration
      transports: ['polling'], // Force polling for Vercel compatibility
      allowEIO3: true,
      pingTimeout: 60000,
      pingInterval: 25000
    })
    
    res.socket.server.io = io
    // Store globally for access from other API routes
    ;(global as any).io = io
    
    io.on('connection', (socket) => {
      console.log(`🔌 Client connected: ${socket.id}`)
      
      // Driver joins the system
      socket.on('driver:join', async (driverId: string) => {
        console.log(`🚗 Driver ${driverId} joined`)
        socket.data.userId = driverId
        socket.data.userType = 'driver'
        socket.data.driverId = driverId
        
        // Join driver-specific room
        socket.join(`driver:${driverId}`)
        
        // Join general drivers room for broadcast notifications
        socket.join('drivers')
        
        // Update driver status to online (using User model with driverProfile)
        try {
          await connectToDatabase()
          await User.findByIdAndUpdate(driverId, {
            'driverProfile.isOnline': true,
            lastActive: new Date()
          })
          console.log(`✅ Driver ${driverId} marked as online`)
        } catch (error) {
          console.error(`❌ Error updating driver status:`, error)
        }
      })
      
      // Rider joins the system
      socket.on('rider:join', (riderId: string) => {
        console.log(`🧑‍🤝‍🧑 Rider ${riderId} joined`)
        socket.data.userId = riderId
        socket.data.userType = 'rider'
        socket.data.riderId = riderId
        
        // Join rider-specific room
        socket.join(`rider:${riderId}`)
      })
      
      // Driver updates location
      socket.on('driver:update_location', async (data) => {
        const { driverId, coordinates } = data
        console.log(`📍 Driver ${driverId} location update:`, coordinates)
        
        try {
          await connectToDatabase()
          await User.findByIdAndUpdate(driverId, {
            'driverProfile.currentLocation.coordinates': [coordinates.longitude, coordinates.latitude],
            'driverProfile.lastLocationUpdate': new Date()
          })
          
          // Broadcast location update to any active rides
          socket.broadcast.emit('driver:location_update', {
            driverId,
            coordinates,
            timestamp: new Date()
          })
          
        } catch (error) {
          console.error(`❌ Error updating driver location:`, error)
        }
      })
      
      // Handle disconnection
      socket.on('disconnect', async () => {
        console.log(`🔌 Client disconnected: ${socket.id}`)
        
        if (socket.data.userType === 'driver' && socket.data.driverId) {
          try {
            await connectToDatabase()
            await User.findByIdAndUpdate(socket.data.driverId, {
              'driverProfile.isOnline': false,
              lastActive: new Date()
            })
            console.log(`🚗 Driver ${socket.data.driverId} marked as offline`)
          } catch (error) {
            console.error(`❌ Error updating driver offline status:`, error)
          }
        }
      })
    })
    
    console.log('✅ Socket.IO server initialized')
  }
  
  res.end()
}

// Export the Socket.IO instance for use in other API routes
export { ServerIO }

// Helper function to get the Socket.IO instance
export function getSocketIO(): ServerIO | null {
  // This will be set by the socket handler
  return (global as any).io || null
}

// Helper function to notify nearby drivers about a new ride
export async function notifyNearbyDrivers(rideData: any) {
  const io = getSocketIO()
  if (!io) {
    console.log('⚠️ Socket.IO not available, skipping real-time notifications')
    return
  }
  
  try {
    await connectToDatabase()
    
    const pickupLat = rideData.pickup.coordinates.latitude
    const pickupLng = rideData.pickup.coordinates.longitude
    
    // Find all online drivers (using User model with driverProfile)
    const onlineDrivers = await User.find({
      'driverProfile.isOnline': true,
      'driverProfile.currentLocation.coordinates': { $exists: true, $ne: null },
      isActive: true
    }).lean()
    
    console.log(`📢 Notifying ${onlineDrivers.length} online drivers about new ride`)
    
    // Notify drivers within 5 miles
    for (const driver of onlineDrivers) {
      // User model stores coordinates as [longitude, latitude] array
      if (!driver.driverProfile?.currentLocation?.coordinates || driver.driverProfile.currentLocation.coordinates.length < 2) {
        console.log(`⚠️ Driver ${driver.firstName} has invalid coordinates, skipping`)
        continue
      }
      
      const driverLng = driver.driverProfile.currentLocation.coordinates[0] // longitude
      const driverLat = driver.driverProfile.currentLocation.coordinates[1] // latitude
      const distance = calculateDistance(pickupLat, pickupLng, driverLat, driverLng)
      
      if (distance <= 5) {
        console.log(`🎯 Notifying driver ${driver.firstName} (${distance.toFixed(2)} miles away)`)
        
        // Send ride notification to specific driver
        io.to(`driver:${driver._id}`).emit('ride:new', {
          ...rideData,
          distanceToPickup: distance,
          estimatedTimeToPickup: Math.ceil(distance * 2.5) + ' minutes'
        })
        
        // Trigger notification sound
        io.to(`driver:${driver._id}`).emit('notification:sound')
      }
    }
    
  } catch (error) {
    console.error('❌ Error notifying nearby drivers:', error)
  }
}

// Helper function to notify rider about ride status updates
export async function notifyRiderStatusUpdate(riderId: string, rideData: any) {
  const io = getSocketIO()
  if (!io) {
    console.log('⚠️ Socket.IO not available, skipping rider notification')
    return
  }
  
  console.log(`📱 Notifying rider ${riderId} about ride status update`)
  io.to(`rider:${riderId}`).emit('ride:status_update', rideData)
}
