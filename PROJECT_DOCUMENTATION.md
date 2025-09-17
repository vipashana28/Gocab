# GoCabs - Comprehensive Project Documentation

## Project Overview

**GoCabs** is a modern, eco-friendly ride-sharing platform built with Next.js 14, featuring real-time tracking, driver-rider matching, and comprehensive ride management. The application emphasizes sustainability while providing a seamless transportation experience.

### Core Mission
- Provide eco-friendly transportation solutions
- Connect riders with available drivers in real-time
- Promote carbon-neutral travel options
- Deliver a professional, Uber-like user experience

---

## Technology Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Lucide React icons
- **Maps**: Google Maps API
- **Real-time**: Pusher WebSocket client

### Backend
- **Runtime**: Node.js
- **Framework**: Next.js API routes
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: NextAuth.js with Google OAuth
- **Real-time**: Pusher WebSocket server
- **Location**: Google Maps Geocoding & Directions API

### Infrastructure
- **Deployment**: Vercel (Production)
- **Database**: MongoDB Atlas
- **Real-time**: Pusher Channels
- **Authentication**: Google OAuth 2.0
- **Maps**: Google Cloud Platform APIs

---

## Project Structure

### Root Directory
```
├── app/                    # Next.js 14 App Router
├── components/             # Reusable UI components
├── lib/                    # Utilities and services
├── public/                 # Static assets
├── middleware.ts           # Authentication middleware
├── next.config.mjs         # Next.js configuration
├── tailwind.config.js      # Tailwind CSS configuration
├── tsconfig.json          # TypeScript configuration
└── vercel.json            # Deployment configuration
```

### App Directory (`/app`)

#### Main Application Pages
- **`/page.tsx`** - Landing page with Google sign-in
- **`/dashboard/page.tsx`** - Rider dashboard (1860 lines)
- **`/driver/page.tsx`** - Driver dashboard (934 lines)
- **`/events/page.tsx`** - Events listing page (668 lines)

#### API Routes (`/app/api`)

##### Authentication APIs
- **`/auth/[...nextauth]/route.ts`** - NextAuth.js configuration
- **`/auth/sync-user/route.ts`** - User synchronization
- **`/auth/update-activity/route.ts`** - Activity tracking

##### User Management APIs
- **`/users/phone/route.ts`** - Driver registration & vehicle details
- **`/users/[userId]/active-rides/route.ts`** - User ride management

##### Driver APIs
- **`/drivers/route.ts`** - Driver CRUD operations
- **`/drivers/location/route.ts`** - Driver location tracking
- **`/drivers/available-rides/route.ts`** - Available ride notifications
- **`/drivers/rides/route.ts`** - Driver ride management
- **`/drivers/status/route.ts`** - Driver online/offline status

##### Ride Management APIs
- **`/rides/route.ts`** - Ride creation and listing
- **`/rides/[rideId]/route.ts`** - Individual ride operations
- **`/rides/[rideId]/accept/route.ts`** - Driver ride acceptance
- **`/rides/[rideId]/status/route.ts`** - Ride status updates
- **`/rides/[rideId]/location/route.ts`** - Real-time location tracking

##### Utility APIs
- **`/directions/route.ts`** - Route calculation & fare estimation
- **`/geocoding/route.ts`** - Address to coordinates conversion
- **`/events/route.ts`** - Events data management
- **`/health/route.ts`** - System health checks

##### Notification APIs
- **`/notifications/sse/`** - Server-sent events (planned)

### Components Directory (`/components`)

#### Core Components
- **`PhoneCollectionModal.tsx`** (302 lines) - Driver registration modal
  - Collects phone, vehicle name, license plate, vehicle type
  - Comprehensive validation and error handling
  - Professional UI with gradient design

- **`FareEstimation.tsx`** (439 lines) - Fare calculation component
  - SGD-based pricing system
  - Base fare: S$3.50, Distance: S$0.70/km, Time: S$0.25/min
  - Platform fee: 5% of total cost
  - Detailed fare breakdown display

- **`RouteDisplayModal.tsx`** - Route visualization modal

#### Map Components
- **`Map/MapView.tsx`** - Google Maps integration
  - Real-time driver tracking
  - Pickup/destination markers
  - Route polyline display
  - Interactive map controls

### Library Directory (`/lib`)

#### Authentication (`/lib/auth`)
- **`auth-provider.tsx`** - Authentication context provider
- **`use-gocab-auth-google.tsx`** - Google OAuth hook
- **`server-auth.ts`** - Server-side authentication utilities

#### Database Models (`/lib/models`)
- **`User.ts`** - User model with driver profile
  - Personal information, vehicle details
  - Driver profile for location/status tracking
  - Ride history and carbon savings

- **`Driver.ts`** - Comprehensive driver model
  - Vehicle information, background checks
  - Working hours, pilot program data
  - Earnings and ratings

- **`Ride.ts`** - Ride management model
  - Pickup/destination coordinates
  - Pricing, status tracking
  - Driver assignment and real-time updates

- **`Event.ts`** - Events model for community features

#### Services (`/lib/services`)
- **`pusher.ts`** - Real-time WebSocket services
  - Driver location broadcasting
  - Ride status updates
  - Real-time notifications

#### Utilities
- **`mongodb.ts`** - Database connection management
- **`geocoding.ts`** - Google Maps geocoding utilities
- **`googleMapsLoader.ts`** - Maps API loader

#### Hooks (`/lib/hooks`)
- **`use-gps-tracking.ts`** - GPS location tracking
- **`use-pusher.ts`** - Pusher WebSocket client
- **`use-pusher-fixed.ts`** - Enhanced Pusher implementation

---

## Core Application Flows

### 1. User Authentication Flow
1. **Landing Page** - Google OAuth sign-in
2. **Middleware** - Route protection and session validation
3. **User Sync** - Create/update user in MongoDB
4. **Dashboard Redirect** - Route to appropriate dashboard

### 2. Driver Registration Flow
1. **Authentication Check** - Verify user is signed in
2. **Vehicle Details Modal** - Collect comprehensive driver information:
   - Phone number (international format)
   - Vehicle name and model
   - License plate number
   - Vehicle type (4-wheeler/6-wheeler)
3. **Data Storage** - Store in both User fields and driverProfile
4. **Profile Initialization** - Set up driver tracking capabilities

### 3. Ride Request Flow
1. **Location Input** - Pickup and destination addresses
2. **Geocoding** - Convert addresses to coordinates
3. **Route Calculation** - Google Directions API
4. **Fare Estimation** - SGD-based pricing calculation
5. **Driver Search** - Real-time driver matching
6. **Ride Creation** - Store ride in database
7. **Driver Notification** - Pusher broadcast to nearby drivers

### 4. Driver Matching Flow
1. **Location Tracking** - Continuous GPS tracking
2. **Availability Status** - Online/offline management
3. **Ride Notifications** - Receive nearby ride requests
4. **Ride Acceptance** - Driver accepts/declines rides
5. **Real-time Updates** - Status broadcasting to riders

### 5. Active Ride Flow
1. **Driver Assignment** - Match rider with driver
2. **Real-time Tracking** - Live location updates
3. **Status Updates** - En route, arrived, in progress
4. **ETA Calculation** - Dynamic arrival time estimation
5. **Ride Completion** - Final status and summary

---

## Pricing System

### SGD Fare Structure
- **Base Fare**: S$3.50
- **Distance Rate**: S$0.70 per kilometer
- **Time Rate**: S$0.25 per minute
- **Platform Fee**: 5% of subtotal
- **Surge Pricing**: Dynamic based on demand
- **Minimum Fare**: S$4.00

### Fare Calculation Example
```
Distance: 5 km × S$0.70 = S$3.50
Time: 10 min × S$0.25 = S$2.50
Base Fare: S$3.50
Subtotal: S$9.50
Platform Fee (5%): S$0.48
Total: S$9.98
```

---

## Database Architecture

### User Collection
```javascript
{
  googleId: String,           // Google OAuth ID
  email: String,              // Email address
  firstName: String,          // First name
  lastName: String,           // Last name
  phone: String,              // Phone number
  vehicleName: String,        // Vehicle make/model
  licensePlate: String,       // License plate
  vehicleType: String,        // 4-wheeler/6-wheeler
  driverProfile: {            // Driver-specific data
    isOnline: Boolean,
    currentLocation: {
      type: 'Point',
      coordinates: [lng, lat]
    },
    vehicleInfo: String,
    licensePlate: String,
    rating: Number
  },
  totalRides: Number,
  totalCarbonSaved: Number,
  lastActive: Date
}
```

### Ride Collection
```javascript
{
  rideId: String,             // Unique ride identifier
  userId: ObjectId,           // Rider reference
  driverId: ObjectId,         // Driver reference (optional)
  status: String,             // requested/matched/completed
  pickup: {
    address: String,
    coordinates: { lat: Number, lng: Number }
  },
  destination: {
    address: String,
    coordinates: { lat: Number, lng: Number }
  },
  pricing: {
    baseFare: Number,
    distanceFare: Number,
    timeFare: Number,
    platformFee: Number,
    total: Number
  },
  driverContact: {
    name: String,
    phone: String,
    vehicleInfo: String,
    licensePlate: String
  },
  createdAt: Date,
  completedAt: Date
}
```

---

## Real-time Features

### Pusher WebSocket Integration
- **Driver Location Broadcasting** - Live GPS tracking
- **Ride Status Updates** - Real-time status changes
- **Driver Notifications** - Instant ride alerts
- **Connection Management** - Automatic reconnection
- **Channel Subscription** - User and driver channels

### Live Tracking Capabilities
- **Driver ETA Calculation** - Haversine formula implementation
- **Map Ping Indicators** - Animated location markers
- **Status Synchronization** - Cross-device state management
- **Offline Handling** - Graceful disconnection management

---

## Security & Authentication

### Authentication System
- **NextAuth.js** - Industry-standard authentication
- **Google OAuth** - Secure social login
- **Session Management** - Server-side session handling
- **Route Protection** - Middleware-based access control

### API Security
- **Protected Routes** - All APIs require authentication
- **Input Validation** - Comprehensive data validation
- **Error Handling** - Structured error responses
- **Data Sanitization** - XSS and injection prevention

### Middleware Protection
```javascript
// Protected routes
['/api/((?!auth).*)', '/dashboard/:path*', '/driver/:path*', '/events/:path*']
```

---

## Environmental Features

### Carbon Footprint Tracking
- **Ride Impact Calculation** - CO₂ savings per ride
- **Cumulative Savings** - Total environmental impact
- **Green Incentives** - Eco-friendly ride promotion
- **Impact Visualization** - Environmental dashboard

### Sustainability Focus
- **Vehicle Type Tracking** - Support for eco-friendly vehicles
- **Carbon Neutral Goals** - Environmental impact awareness
- **Green Metrics** - Sustainability KPIs
- **Community Impact** - Collective environmental contribution

---

## UI/UX Design

### Design System
- **Color Palette**: Green-focused (environmental theme)
- **Typography**: Professional, clean fonts
- **Components**: Consistent, reusable elements
- **Responsive Design**: Mobile-first approach

### Key UI Features
- **Live Tracking Maps** - Real-time location visualization
- **Animated Ping Indicators** - Location status indicators
- **Professional Modals** - Driver registration, route display
- **Status Cards** - Ride progress tracking
- **Thank You Cards** - Post-ride experience

### Mobile Optimization
- **Touch-Friendly Controls** - Optimized for mobile interaction
- **Responsive Layouts** - Adaptive design across devices
- **Performance** - Optimized loading and animations
- **Accessibility** - Screen reader and keyboard support

---

## Development Tools & Configuration

### Code Quality
- **TypeScript** - Type safety and development experience
- **ESLint** - Code linting and style enforcement
- **Prettier** - Code formatting consistency
- **Git Hooks** - Pre-commit validation

### Build System
- **Next.js 14** - React framework with App Router
- **Turbopack** - Fast development builds
- **Vercel Deployment** - Seamless production deployment
- **Environment Variables** - Secure configuration management

---

## Performance Optimizations

### Frontend Performance
- **Dynamic Imports** - Code splitting for faster loads
- **Image Optimization** - Next.js Image component
- **Caching Strategies** - API response caching
- **Bundle Analysis** - Optimized JavaScript delivery

### Backend Performance
- **Database Indexing** - Optimized query performance
- **Connection Pooling** - Efficient database connections
- **API Rate Limiting** - Resource protection
- **Error Boundaries** - Graceful error handling

---

## Future Enhancement Opportunities

### Immediate Improvements (Sprint 1)
1. **Payment Integration**
   - Stripe payment processing
   - Multiple payment methods
   - Automatic billing and receipts

2. **Enhanced Driver Features**
   - Earnings dashboard
   - Performance analytics
   - Driver ratings system

3. **Advanced Ride Features**
   - Ride scheduling
   - Recurring trips
   - Trip sharing

### Medium-term Features (Sprint 2-3)
4. **AI-Powered Optimizations**
   - Dynamic pricing algorithms
   - Route optimization
   - Demand prediction

5. **Advanced Safety Features**
   - Emergency SOS button
   - Driver background verification
   - Real-time safety monitoring

6. **Multi-language Support**
   - Internationalization (i18n)
   - Regional currency support
   - Local regulations compliance

### Long-term Vision (Sprint 4+)
7. **Fleet Management**
   - Corporate accounts
   - Vehicle fleet tracking
   - Business analytics dashboard

8. **Environmental Expansion**
   - Carbon offset marketplace
   - Electric vehicle incentives
   - Environmental impact reporting

9. **Platform Expansion**
   - Food delivery integration
   - Package delivery services
   - Multi-modal transportation

### Technical Enhancements
10. **Performance & Scalability**
    - Redis caching layer
    - CDN integration
    - Microservices architecture

11. **Advanced Analytics**
    - User behavior analytics
    - Business intelligence dashboard
    - Predictive modeling

12. **Developer Experience**
    - GraphQL API layer
    - Automated testing suite
    - CI/CD pipeline enhancement

---

## Metrics & KPIs

### Business Metrics
- **Ride Completion Rate** - Successful trip percentage
- **Driver Utilization** - Active driver efficiency
- **Customer Satisfaction** - Rider/driver ratings
- **Revenue per Ride** - Financial performance

### Technical Metrics
- **API Response Times** - Performance monitoring
- **Error Rates** - System reliability
- **Real-time Connection** - WebSocket performance
- **Database Performance** - Query optimization

### Environmental Metrics
- **Carbon Savings** - Environmental impact
- **Eco-friendly Rides** - Green transportation adoption
- **Vehicle Efficiency** - Fleet environmental performance

---

## Development Guidelines

### Code Standards
- **TypeScript First** - All new code in TypeScript
- **Component Modularity** - Reusable, testable components
- **API Consistency** - Standardized response formats
- **Error Handling** - Comprehensive error management

### Git Workflow
- **Feature Branches** - Isolated feature development
- **Pull Requests** - Code review process
- **Conventional Commits** - Standardized commit messages
- **Automated Testing** - CI/CD integration

### Deployment Process
- **Environment Separation** - Dev/staging/production
- **Feature Flags** - Controlled feature rollouts
- **Monitoring** - Application performance monitoring
- **Rollback Strategy** - Quick recovery procedures

---

## Support & Maintenance

### Documentation Maintenance
- **API Documentation** - Keep endpoints documented
- **Code Comments** - Maintain inline documentation
- **Architecture Updates** - Reflect system changes
- **User Guides** - End-user documentation

### System Monitoring
- **Health Checks** - System status monitoring
- **Error Tracking** - Issue identification and resolution
- **Performance Monitoring** - Response time tracking
- **User Feedback** - Continuous improvement

---

*This documentation is maintained as a living document and should be updated with each major system change or feature addition.*

**Last Updated**: December 2024  
**Version**: 1.0  
**Maintainer**: Development Team