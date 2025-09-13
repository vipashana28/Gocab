# Pusher Configuration for GoCabs

## Required Environment Variables

Add these environment variables to your Vercel deployment:

### Server-side (Private)
```
PUSHER_APP_ID=your-pusher-app-id
PUSHER_KEY=your-pusher-key  
PUSHER_SECRET=your-pusher-secret
PUSHER_CLUSTER=your-pusher-cluster
```

### Client-side (Public)
```
NEXT_PUBLIC_PUSHER_KEY=your-pusher-key
NEXT_PUBLIC_PUSHER_CLUSTER=your-pusher-cluster
```

## How to Get Pusher Credentials

1. **Sign up for Pusher**: Go to https://pusher.com/
2. **Create a new app**: 
   - Name: "GoCabs"
   - Cluster: Choose closest to your users (e.g., "us-east-1")
   - Frontend: React
   - Backend: Node.js
3. **Get credentials**: From your app dashboard, copy:
   - App ID
   - Key 
   - Secret
   - Cluster

## Vercel Environment Variables Setup

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add each variable:
   - `PUSHER_APP_ID` = your app ID
   - `PUSHER_KEY` = your key
   - `PUSHER_SECRET` = your secret  
   - `PUSHER_CLUSTER` = your cluster
   - `NEXT_PUBLIC_PUSHER_KEY` = your key (same as PUSHER_KEY)
   - `NEXT_PUBLIC_PUSHER_CLUSTER` = your cluster (same as PUSHER_CLUSTER)

## Free Tier Limits

Pusher free tier includes:
- 200,000 messages/day
- 100 concurrent connections
- Unlimited channels

This is sufficient for development and early production use.

## Channels Used

- `driver-{driverId}` - Individual driver notifications
- `rider-{riderId}` - Individual rider notifications  
- `driver-locations` - Global driver location updates

## Events

- `ride:new` - New ride available for drivers
- `ride:status_update` - Ride status changes for riders
- `notification:sound` - Audio notification trigger
- `location:update` - Driver location updates
