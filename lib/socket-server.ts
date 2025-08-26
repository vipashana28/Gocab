import { Server as NetServer } from 'http'
import { NextApiResponse } from 'next'
import { Server as SocketIOServer } from 'socket.io'

export type NextApiResponseServerIO = NextApiResponse & {
  socket: {
    server: NetServer & {
      io: SocketIOServer
    }
  }
}

export interface DriverLocationUpdate {
  rideId: string
  driverId: string
  coordinates: {
    latitude: number
    longitude: number
  }
  heading?: number
  speed?: number
  timestamp: Date
}

export interface RideStatusUpdate {
  rideId: string
  status: 'requested' | 'matched' | 'driver_en_route' | 'arrived' | 'in_progress' | 'completed' | 'cancelled'
  statusDisplay: string
  estimatedArrival?: string
  additionalInfo?: any
}

export function initializeSocketIO(httpServer: NetServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    path: '/api/socket',
    addTrailingSlash: false,
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? process.env.NEXTAUTH_URL 
        : "http://localhost:3000",
      methods: ["GET", "POST"]
    }
  })

  io.on('connection', (socket) => {
    console.log('🔗 Socket client connected:', socket.id)

    // Join ride room for real-time updates
    socket.on('join-ride', (rideId: string) => {
      socket.join(`ride-${rideId}`)
      console.log(`📍 Socket ${socket.id} joined ride room: ride-${rideId}`)
    })

    // Leave ride room
    socket.on('leave-ride', (rideId: string) => {
      socket.leave(`ride-${rideId}`)
      console.log(`🚪 Socket ${socket.id} left ride room: ride-${rideId}`)
    })

    // Driver location updates (from driver app/simulation)
    socket.on('driver-location-update', (data: DriverLocationUpdate) => {
      console.log('📍 Driver location update:', data)
      
      // Broadcast to all users in the ride room
      socket.to(`ride-${data.rideId}`).emit('driver-moved', {
        coordinates: data.coordinates,
        heading: data.heading,
        speed: data.speed,
        timestamp: data.timestamp
      })
    })

    // Ride status updates
    socket.on('ride-status-update', (data: RideStatusUpdate) => {
      console.log('📱 Ride status update:', data)
      
      // Broadcast to all clients in the ride room
      io.to(`ride-${data.rideId}`).emit('ride-status-changed', data)
    })

    // Driver accepts ride
    socket.on('driver-accepted-ride', (data: { rideId: string, driverInfo: any }) => {
      console.log('✅ Driver accepted ride:', data)
      
      io.to(`ride-${data.rideId}`).emit('driver-matched', {
        driverInfo: data.driverInfo,
        status: 'matched',
        statusDisplay: 'Driver Found'
      })
    })

    // Driver arrival notifications
    socket.on('driver-arrived', (data: { rideId: string }) => {
      console.log('🚗 Driver arrived:', data)
      
      io.to(`ride-${data.rideId}`).emit('driver-arrived', {
        status: 'arrived',
        statusDisplay: 'Driver Arrived'
      })
    })

    // Trip started
    socket.on('trip-started', (data: { rideId: string }) => {
      console.log('🚀 Trip started:', data)
      
      io.to(`ride-${data.rideId}`).emit('trip-started', {
        status: 'in_progress',
        statusDisplay: 'Trip in Progress'
      })
    })

    // Trip completed
    socket.on('trip-completed', (data: { rideId: string, tripSummary: any }) => {
      console.log('🏁 Trip completed:', data)
      
      io.to(`ride-${data.rideId}`).emit('trip-completed', {
        status: 'completed',
        statusDisplay: 'Trip Completed',
        tripSummary: data.tripSummary
      })
    })

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('🔌 Socket client disconnected:', socket.id)
    })
  })

  return io
}

// Driver location simulation for demo purposes
export function startDriverLocationSimulation(
  io: SocketIOServer, 
  rideId: string, 
  startLocation: { latitude: number, longitude: number },
  endLocation: { latitude: number, longitude: number }
) {
  console.log('🎬 Starting driver location simulation for ride:', rideId)
  
  let currentLocation = { ...startLocation }
  const totalSteps = 20 // Number of updates
  let currentStep = 0
  
  const latStep = (endLocation.latitude - startLocation.latitude) / totalSteps
  const lonStep = (endLocation.longitude - startLocation.longitude) / totalSteps
  
  const interval = setInterval(() => {
    if (currentStep >= totalSteps) {
      clearInterval(interval)
      console.log('🏁 Driver simulation completed for ride:', rideId)
      
      // Send driver arrived notification
      io.to(`ride-${rideId}`).emit('driver-arrived', {
        status: 'arrived',
        statusDisplay: 'Driver Arrived at Pickup Location'
      })
      return
    }
    
    // Update location
    currentLocation.latitude += latStep
    currentLocation.longitude += lonStep
    currentStep++
    
    // Calculate estimated arrival time (remaining steps * 3 seconds)
    const remainingTime = Math.ceil((totalSteps - currentStep) * 3 / 60) // minutes
    
    // Broadcast location update
    io.to(`ride-${rideId}`).emit('driver-moved', {
      coordinates: currentLocation,
      heading: calculateHeading(currentLocation, endLocation),
      speed: 25, // mph
      timestamp: new Date(),
      estimatedArrival: `${remainingTime} minute${remainingTime !== 1 ? 's' : ''}`
    })
    
    console.log(`📍 Driver simulation step ${currentStep}/${totalSteps} for ride ${rideId}:`, currentLocation)
    
  }, 3000) // Update every 3 seconds
  
  return interval
}

// Helper function to calculate heading between two points
function calculateHeading(from: { latitude: number, longitude: number }, to: { latitude: number, longitude: number }): number {
  const dLon = (to.longitude - from.longitude) * Math.PI / 180
  const lat1 = from.latitude * Math.PI / 180
  const lat2 = to.latitude * Math.PI / 180
  
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  
  let heading = Math.atan2(y, x) * 180 / Math.PI
  heading = (heading + 360) % 360 // Normalize to 0-360
  
  return heading
}
