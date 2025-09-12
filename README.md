# 🚗💚 GoCab - Complete Driver-Rider Booking & Tracking System

A comprehensive, eco-friendly ride-booking platform with real-time driver-rider matching, OTP verification, and environmental impact tracking.

## 🌟 Features

### 🎯 Core Functionality
- **Real-time Driver-Rider Matching** - Smart geospatial queries to find nearby drivers
- **OTP Verification System** - 4-digit secure verification for ride safety
- **Live GPS Tracking** - Real-time location sharing between driver and rider
- **Environmental Impact** - Carbon footprint calculation and social sharing
- **Mobile-First Design** - Responsive UI optimized for mobile devices

### 🚗 Driver Features
- **Driver Dashboard** - Clean interface for managing ride requests
- **Location Sharing** - Automatic GPS updates every 5 seconds
- **Ride Notifications** - Alert system for new ride requests within 5km
- **Accept/Decline System** - Simple tap interface for ride management
- **Real-time Status** - Live updates between driver and rider apps

### 🧑‍🤝‍🧑 Rider Features
- **Auto-location Detection** - Automatic pickup address from GPS
- **Fare Estimation** - Real-time fare calculation with environmental impact
- **Driver Tracking** - Live map view of driver approach
- **Trip Completion** - Environmental impact summary with social sharing
- **Events Integration** - Token2049 and partner event promotion

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Google Maps JavaScript API** for mapping
- **NextAuth.js** for Google authentication

### Backend
- **Next.js API Routes** for serverless functions
- **MongoDB Atlas** with Mongoose ODM
- **Geospatial Indexing** for efficient driver queries
- **Real-time Polling** (ready for WebSocket upgrade)

### Mobile Support
- **Cross-origin headers** for mobile testing
- **Responsive design** for all screen sizes
- **PWA-ready** architecture

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB Atlas account
- Google Maps API key
- Google OAuth credentials

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Samisha68/Gocabs-webapp.git
   cd Gocabs-webapp
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment setup:**
   Create `.env.local`:
   ```env
   MONGODB_URI=your_mongodb_connection_string
   NEXTAUTH_SECRET=your_nextauth_secret
   NEXTAUTH_URL=http://localhost:3000
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
   GOOGLE_MAPS_API_KEY=your_google_maps_api_key
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

5. **Access the app:**
   - **Rider App:** http://localhost:3000
   - **Driver App:** http://localhost:3000/driver
   - **Events:** http://localhost:3000/events

## 📱 Mobile Testing

### Local Network Testing
1. Get your computer's IP: `ifconfig | grep "inet 192"`
2. Connect mobile to same WiFi
3. Access: `http://YOUR_IP:3000`

### Testing Flow
1. **Rider:** Book ride → See "Finding Driver..." → OTP display
2. **Driver:** Sign in → Accept ride → Real-time tracking
3. **Complete:** End-to-end flow with environmental impact

## 🗄️ Database Models

### User Model
- Google authentication integration
- Driver profile with location tracking
- Ride history and carbon savings

### Ride Model
- OTP verification system
- Real-time status tracking
- Environmental impact calculation
- Driver assignment and routing

### Geospatial Indexes
- 2dsphere indexing for driver location
- Efficient nearby driver queries
- Real-time location updates

## 🔧 API Endpoints

### Rider APIs
- `POST /api/rides` - Create ride request
- `GET /api/rides` - Get active rides
- `PATCH /api/rides/[id]` - Update ride status

### Driver APIs
- `GET /api/drivers/rides` - Get nearby ride requests
- `POST /api/rides/[id]/accept` - Accept/decline rides
- `POST /api/drivers/location` - Update driver location

### Real-time APIs
- `POST /api/rides/[id]/location` - Driver location updates
- `GET /api/rides/[id]/location` - Get current tracking data

## 🌱 Environmental Impact

### Carbon Calculation
- CO₂ emissions saved vs private vehicles
- Tree planting equivalency
- Fuel consumption reduction

### Social Sharing
- Pre-composed X (Twitter) posts
- Event-specific hashtags
- Community impact tracking

## 🎯 Scalability

### Current Capacity
- **~10 drivers** (easily scalable to 100+)
- **Geographic distribution** with distance-based matching
- **Real-time updates** with 3-5 second polling
- **Concurrent rides** from multiple users

### Production Ready
- Error handling and validation
- Mobile cross-origin support
- Geospatial database optimization
- Race condition prevention

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Token2049 Singapore** for event integration
- **DeCharge, Superteam Singapore, SEA DePIN, BackerStage** for partnerships
- **Google Maps Platform** for mapping services
- **MongoDB Atlas** for database hosting

---

**Built with ❤️ for sustainable transportation during Token2049 week! 🌱🚗💚**

## 📞 Support

For support and questions:
- Create an issue in this repository
- Contact: [@gocabs_xyz](https://twitter.com/gocabs_xyz)

**Ready to reduce carbon footprint, one ride at a time! 🌍✨**