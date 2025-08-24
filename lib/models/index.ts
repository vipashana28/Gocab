// Export all models for easy importing
export { default as User, type IUser } from './User'
export { default as Driver, type IDriver } from './Driver'
export { default as Ride, type IRide } from './Ride'
export { default as Event, type IEvent } from './Event'

// Type definitions for commonly used data
export interface LocationCoordinates {
  latitude: number
  longitude: number
}

export interface Address {
  address: string
  coordinates: LocationCoordinates
  placeId?: string
}

export interface ContactInfo {
  phone: string
  email: string
  name: string
}

// Common enums
export enum RideStatus {
  REQUESTED = 'requested',
  MATCHED = 'matched',
  DRIVER_EN_ROUTE = 'driver_en_route',
  ARRIVED = 'arrived',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum DriverStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING = 'pending'
}

export enum EventStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  CANCELLED = 'cancelled',
  POSTPONED = 'postponed',
  COMPLETED = 'completed'
}

export enum VehicleType {
  SEDAN = 'sedan',
  SUV = 'suv',
  COMPACT = 'compact',
  HYBRID = 'hybrid',
  ELECTRIC = 'electric'
}

// Utility type for API responses
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
  meta?: {
    total?: number
    page?: number
    limit?: number
    hasMore?: boolean
  }
}

// Carbon footprint calculation utilities
export interface CarbonCalculation {
  distance: number // in miles
  vehicleType: VehicleType
  estimatedSaved: number // kg CO2
  comparisonMethod: string
  calculationMethod: string
}

// Real-time location update interface
export interface LocationUpdate {
  rideId: string
  coordinates: LocationCoordinates
  heading?: number
  timestamp: Date
}

// Ride matching preferences
export interface RidePreferences {
  maxWaitTime?: number // minutes
  maxDetourDistance?: number // miles
  preferEcoFriendly?: boolean
  allowSharedRides?: boolean
}

// Event filtering options
export interface EventFilters {
  category?: string[]
  startDate?: {
    from?: Date
    to?: Date
  }
  location?: {
    coordinates: LocationCoordinates
    radius: number // in meters
  }
  priceRange?: {
    min?: number
    max?: number
  }
  tags?: string[]
  ageRestriction?: string
  isOutdoor?: boolean
  hasTickets?: boolean
}

// Database connection status
export interface DBConnectionStatus {
  isConnected: boolean
  host?: string
  database?: string
  lastConnected?: Date
  error?: string
}

// Default export for convenience
import UserModel from './User'
import DriverModel from './Driver'
import RideModel from './Ride'
import EventModel from './Event'

export default {
  User: UserModel,
  Driver: DriverModel,
  Ride: RideModel,
  Event: EventModel
}
