import Pusher from 'pusher'
import { connectToDatabase } from '@/lib/mongodb'
import { User } from '@/lib/models'

// Server-side Pusher instance
let pusherServer: Pusher | null = null

function getPusherServer(): Pusher {
  if (!pusherServer) {
    pusherServer = new Pusher({
      appId: process.env.PUSHER_APP_ID!,
      key: process.env.PUSHER_KEY!,
      secret: process.env.PUSHER_SECRET!,
      cluster: process.env.PUSHER_CLUSTER!,
      useTLS: true
    })
  }
  return pusherServer
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

// Notify nearby drivers about a new ride
export async function notifyNearbyDriversViaPusher(rideData: any): Promise<void> {
  try {
    await connectToDatabase()
    
    const pickupLat = rideData.pickup.coordinates.latitude
    const pickupLng = rideData.pickup.coordinates.longitude
    
    console.log(`🔔 Pusher: Looking for drivers near ${pickupLat}, ${pickupLng}`)
    
    // First, let's see all users with driver profiles
    const allDriverUsers = await User.find({
      'driverProfile': { $exists: true },
      isActive: true
    }).lean()
    
    console.log(`📊 Pusher: Found ${allDriverUsers.length} total users with driver profiles`)
    
    // Log each driver's status for debugging
    allDriverUsers.forEach(driver => {
      console.log(`👤 Driver ${driver.firstName}: isOnline=${driver.driverProfile?.isOnline}, hasLocation=${!!driver.driverProfile?.currentLocation?.coordinates}`)
    })
    
    // Find all online drivers (using User model with driverProfile)
    const onlineDrivers = await User.find({
      'driverProfile.isOnline': true,
      'driverProfile.currentLocation.coordinates': { $exists: true, $ne: null },
      isActive: true
    }).lean()
    
    console.log(`📢 Pusher: Found ${onlineDrivers.length} online drivers out of ${allDriverUsers.length} total`)
    
    const pusher = getPusherServer()
    let notifiedCount = 0
    
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
        console.log(`🎯 Pusher: Notifying driver ${driver.firstName} (${distance.toFixed(2)} miles away)`)
        
        // Send ride notification to specific driver channel
        await pusher.trigger(`driver-${driver._id}`, 'ride:new', {
          ...rideData,
          distanceToPickup: distance,
          estimatedTimeToPickup: Math.ceil(distance * 2.5) + ' minutes'
        })
        
        // Send notification sound trigger
        await pusher.trigger(`driver-${driver._id}`, 'notification:sound', {
          timestamp: new Date().toISOString()
        })
        
        notifiedCount++
      }
    }
    
    console.log(`✅ Pusher: Successfully notified ${notifiedCount} nearby drivers`)
    
  } catch (error) {
    console.error('❌ Pusher: Error notifying nearby drivers:', error)
    throw error
  }
}

// Notify rider about ride status updates
export async function notifyRiderStatusUpdateViaPusher(riderId: string, rideData: any): Promise<void> {
  try {
    const pusher = getPusherServer()
    
    console.log(`📱 Pusher: Notifying rider ${riderId} about ride status update`)
    
    await pusher.trigger(`rider-${riderId}`, 'ride:status_update', rideData)
    
    console.log(`✅ Pusher: Rider notification sent successfully`)
    
  } catch (error) {
    console.error('❌ Pusher: Error notifying rider:', error)
    throw error
  }
}

// Update driver location (for real-time tracking)
export async function updateDriverLocationViaPusher(driverId: string, coordinates: { latitude: number, longitude: number }): Promise<void> {
  try {
    await connectToDatabase()
    
    // Update driver location in database
    await User.findByIdAndUpdate(driverId, {
      'driverProfile.currentLocation.coordinates': [coordinates.longitude, coordinates.latitude],
      'driverProfile.lastLocationUpdate': new Date()
    })
    
    const pusher = getPusherServer()
    
    // Broadcast location update to any active rides
    await pusher.trigger('driver-locations', 'location:update', {
      driverId,
      coordinates,
      timestamp: new Date().toISOString()
    })
    
    console.log(`📍 Pusher: Driver ${driverId} location updated and broadcasted`)
    
  } catch (error) {
    console.error('❌ Pusher: Error updating driver location:', error)
    throw error
  }
}

// Mark driver as online/offline
export async function updateDriverStatusViaPusher(driverId: string, isOnline: boolean): Promise<void> {
  try {
    await connectToDatabase()
    
    await User.findByIdAndUpdate(driverId, {
      'driverProfile.isOnline': isOnline,
      lastActive: new Date()
    })
    
    console.log(`✅ Pusher: Driver ${driverId} marked as ${isOnline ? 'online' : 'offline'}`)
    
  } catch (error) {
    console.error('❌ Pusher: Error updating driver status:', error)
    throw error
  }
}
