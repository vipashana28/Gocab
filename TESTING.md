# 🧪 GoCab Testing Guide

## Quick Testing Steps

### 1. Start the Application
```bash
npm run dev
```
Access at: `http://localhost:3000` (or `http://192.168.0.10:3000` for LAN testing)

### 2. Test Rider Flow
1. **Sign In**: Click "Continue with Google" or "Try Demo"
2. **Book Ride**: 
   - Enter pickup address (e.g., "123 Main St, San Francisco")
   - Enter destination (e.g., "456 Market St, San Francisco")
   - Click "Book Ride"
3. **Verify**: Should see "Finding Driver..." status without console errors

### 3. Test Driver Flow
1. **Open Driver Interface**: Go to `/driver` in a new tab/window
2. **Sign In**: Use Google auth as a driver
3. **Check Available Rides**: Should see the ride from step 2
4. **Accept Ride**: Click "Accept" on the available ride
5. **Verify**: Ride should disappear from available list

### 4. Test Real-time Tracking
1. **Return to Rider Tab**: Should now show driver details and location
2. **Watch Map**: Driver marker should appear and update every few seconds
3. **Check Console**: Should see clean logs without errors

## Expected Console Output (Clean)

### ✅ Good Logs:
```
🗺️ Loading Google Maps via singleton loader...
✅ Google Maps loaded successfully via singleton
🗺️ Creating Google Maps instance...
✅ Google Maps created successfully
🔍 Geocoding addresses...
✅ Geocoded pickup: {...}
✅ Geocoded destination: {...}
Ride booked successfully: {...}
🚗 Accepting ride: SIMPLE_1234567890
✅ Ride accepted successfully
```

### ❌ Bad Logs (Should Not Appear):
```
TypeError: Cannot read properties of undefined (reading 'latitude')
Map already initializing or initialized, skipping...
Google Maps Marker deprecated → use google.maps.marker.AdvancedMarkerElement
```

## API Endpoints to Test

### Rider APIs
- `POST /api/rides` - Create new ride
- `GET /api/rides?userId=X&status=active` - Get active rides
- `PATCH /api/rides/[id]` - Update ride status

### Driver APIs
- `GET /api/drivers/available-rides?driverId=X&lat=Y&lng=Z` - Get nearby rides
- `POST /api/rides/[id]/accept` - Accept a ride
- `POST /api/rides/[id]/location` - Update driver location

### Health Check
- `GET /api/health` - Verify server is running

## Mobile Testing

### LAN Testing Setup
1. **Find Your IP**: `ipconfig getifaddr en0` (macOS) or `ipconfig` (Windows)
2. **Start Dev Server**: `npm run dev -- --host 0.0.0.0`
3. **Access on Mobile**: `http://YOUR_IP:3000`

### Mobile-Specific Tests
1. **GPS Permission**: Should prompt for location access
2. **Touch Interface**: All buttons should be touch-friendly
3. **Map Gestures**: Pinch to zoom, drag to pan should work
4. **Responsive Design**: UI should adapt to mobile screen

## Troubleshooting

### Common Issues

#### Map Not Loading
- Check `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `.env.local`
- Verify API key has Maps JavaScript API enabled
- Check browser console for API errors

#### Coordinates Undefined Error
- ✅ **FIXED**: Added comprehensive coordinate guards
- If still occurring, check for new coordinate access without guards

#### Multiple Map Initializations
- ✅ **FIXED**: Implemented singleton loader
- If still occurring, check for duplicate MapView components

#### Driver Not Receiving Alerts
- Verify driver is signed in and location is enabled
- Check `/api/drivers/available-rides` returns data
- Ensure ride status is `requested` (not already assigned)

### Debug Commands
```bash
# Check API health
curl http://localhost:3000/api/health

# Check available rides for driver
curl "http://localhost:3000/api/drivers/available-rides?driverId=DRIVER_ID&lat=37.7749&lng=-122.4194"

# Check active rides for user
curl "http://localhost:3000/api/rides?userId=USER_ID&status=active"
```

## Success Criteria

### ✅ All Tests Pass When:
1. **No Console Errors**: Clean browser console during entire flow
2. **Smooth Booking**: Rider can book without crashes
3. **Driver Alerts**: Driver sees available rides immediately
4. **Real-time Updates**: Map updates driver location smoothly
5. **Mobile Friendly**: Works on mobile devices over LAN
6. **API Responses**: All endpoints return proper JSON responses

### 🎯 Performance Targets:
- **Map Load Time**: < 3 seconds
- **Ride Booking**: < 2 seconds response
- **Driver Location Updates**: Every 2-5 seconds
- **Mobile Responsiveness**: < 1 second UI updates

## Next Steps After Testing

If all tests pass:
1. **Deploy to Production**: Configure production environment
2. **Add Real Drivers**: Onboard actual drivers with background checks
3. **Payment Integration**: Add Stripe/PayPal for real transactions
4. **Push Notifications**: Enhance driver alerts with push notifications
5. **Advanced Features**: Trip history, ratings, scheduling

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify all environment variables are set
3. Ensure MongoDB connection is working
4. Test API endpoints individually
5. Check network connectivity for mobile testing
