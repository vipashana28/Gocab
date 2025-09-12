import { NextApiRequest, NextApiResponse } from 'next'
import { Server as ServerIO } from 'socket.io'

export default function SocketHandler(req: NextApiRequest, res: NextApiResponse) {
  if (res.socket.server.io) {
    console.log('Socket is already running')
  } else {
    console.log('Socket is initializing')
    const io = new ServerIO(res.socket.server)
    res.socket.server.io = io

    io.on('connection', (socket) => {
      console.log('🔗 Client connected:', socket.id)

      // Join ride room for real-time updates
      socket.on('join-ride', (rideId: string) => {
        socket.join(`ride-${rideId}`)
        console.log(`📍 Socket ${socket.id} joined ride room: ${rideId}`)
      })

      // Leave ride room
      socket.on('leave-ride', (rideId: string) => {
        socket.leave(`ride-${rideId}`)
        console.log(`🚪 Socket ${socket.id} left ride room: ${rideId}`)
      })

      // Driver location updates
      socket.on('driver-location-update', (data: any) => {
        socket.to(`ride-${data.rideId}`).emit('driver-moved', {
          coordinates: data.coordinates,
          heading: data.heading,
          speed: data.speed,
          timestamp: data.timestamp,
          estimatedArrival: data.estimatedArrival
        })
      })

      // Ride status updates
      socket.on('ride-status-update', (data: any) => {
        socket.to(`ride-${data.rideId}`).emit('ride-status-changed', {
          status: data.status,
          statusDisplay: data.statusDisplay,
          estimatedArrival: data.estimatedArrival,
          additionalInfo: data.additionalInfo
        })
      })

      // Driver matched notification
      socket.on('driver-matched', (data: any) => {
        socket.to(`ride-${data.rideId}`).emit('driver-matched', {
          driverInfo: data.driverInfo,
          status: data.status,
          statusDisplay: data.statusDisplay
        })
      })

      // Driver arrived notification
      socket.on('driver-arrived', (data: any) => {
        socket.to(`ride-${data.rideId}`).emit('driver-arrived', {
          status: 'arrived',
          statusDisplay: 'Driver has arrived!',
          additionalInfo: data.additionalInfo
        })
      })

      // Trip completion
      socket.on('trip-completed', (data: any) => {
        socket.to(`ride-${data.rideId}`).emit('trip-completed', {
          status: 'completed',
          statusDisplay: 'Trip completed',
          tripSummary: data.tripSummary
        })
      })

      socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id)
      })
    })
  }
  res.end()
}
