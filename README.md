# GoCab - Eco-Friendly Ride Booking Platform

A pilot ride-sharing platform built as a **full-stack Next.js application** with MongoDB, featuring Civic Auth integration and carbon footprint tracking.

## Quick Start

### Prerequisites
- Node.js 18+ 
- MongoDB (local or cloud)
- Google Maps API Key
- Civic Auth Client ID

### Setup (Single Next.js App)
```bash
# Clone and setup
npm install
cp env.example .env.local
# Edit .env.local with your API keys
npm run dev
```

Application runs on: **http://localhost:3000**
- Frontend: React components and pages
- Backend: API routes at `/api/*`

### Environment Variables (.env.local)

**Required for Authentication:**
- `NEXT_PUBLIC_CIVIC_AUTH_CLIENT_ID` - Get from [auth.civic.com](https://auth.civic.com)

**Required for Maps:**  
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` - Your Google Maps API key

**Required for Database:**
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - JWT signing secret

**Optional for Enhanced Features:**
- `CLIMATIQ_API_KEY` - Carbon footprint calculation API key

### Getting Your Civic Auth Client ID

1. Visit [auth.civic.com](https://auth.civic.com)
2. Create an account or sign in
3. Create a new application
4. Copy the Client ID to your `.env.local` file
5. Restart your development server

## Project Structure

```
├── app/              # Next.js 14 App Router
│   ├── api/          # Backend API routes
│   ├── globals.css   # Global styles
│   ├── layout.tsx    # Root layout
│   └── page.tsx      # Home page
├── lib/              # Utilities and configurations
│   ├── mongodb.ts    # Database connection
│   └── models/       # MongoDB models
└── components/       # Reusable React components
```

## Development Status

This is a 7-day pilot project targeting:
- 8-10 pre-approved drivers
- Fixed pool of sponsored riders
- Core ride booking functionality
- Real-time GPS tracking
- Carbon footprint calculation
- Event discovery and QR verification

## Tech Stack

- **Full-Stack Framework**: Next.js 14 (App Router)
- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Socket.io
- **Database**: MongoDB with Mongoose
- **Auth**: Civic Auth integration
- **Maps**: Google Maps API
- **Real-time**: Socket.io for GPS tracking
