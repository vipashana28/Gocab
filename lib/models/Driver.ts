import mongoose from 'mongoose'

export interface IDriver extends mongoose.Document {
  // Personal Information
  driverId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  profilePicture?: string
  
  // Driver License & Verification
  licenseNumber: string
  licenseExpiry: Date
  backgroundCheckStatus: 'pending' | 'approved' | 'rejected'
  backgroundCheckDate?: Date
  
  // Vehicle Information
  vehicle: {
    make: string
    model: string
    year: number
    color: string
    licensePlate: string
    capacity: number
    vehicleType: 'sedan' | 'suv' | 'compact' | 'hybrid' | 'electric'
    isEcoFriendly: boolean
    fuelEfficiency?: number // miles per gallon or equivalent
  }
  
  // Current Status & Location
  isOnline: boolean
  isAvailable: boolean
  currentLocation?: {
    address?: string
    coordinates: {
      latitude: number
      longitude: number
    }
    lastUpdated: Date
  }
  
  // Driver Stats
  totalRides: number
  totalDistance: number // in miles
  averageRating: number
  totalEarnings: number
  carbonSavedForRiders: number // total CO2 saved for all rides
  
  // Schedule & Availability
  workingHours: {
    monday: { start: string, end: string, active: boolean }
    tuesday: { start: string, end: string, active: boolean }
    wednesday: { start: string, end: string, active: boolean }
    thursday: { start: string, end: string, active: boolean }
    friday: { start: string, end: string, active: boolean }
    saturday: { start: string, end: string, active: boolean }
    sunday: { start: string, end: string, active: boolean }
  }
  
  // Pilot Program Specific
  isPilotApproved: boolean
  pilotStartDate: Date
  pilotNotes?: string
  
  // Account Status
  status: 'active' | 'inactive' | 'suspended' | 'pending'
  joinDate: Date
  lastActive: Date
}

const driverSchema = new mongoose.Schema<IDriver>({
  // Personal Information
  driverId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  profilePicture: String,
  
  // Driver License & Verification
  licenseNumber: {
    type: String,
    required: true,
    unique: true
  },
  licenseExpiry: {
    type: Date,
    required: true
  },
  backgroundCheckStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  backgroundCheckDate: Date,
  
  // Vehicle Information
  vehicle: {
    make: {
      type: String,
      required: true
    },
    model: {
      type: String,
      required: true
    },
    year: {
      type: Number,
      required: true,
      min: 2010 // Minimum vehicle year for pilot
    },
    color: {
      type: String,
      required: true
    },
    licensePlate: {
      type: String,
      required: true,
      unique: true,
      uppercase: true
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
      max: 8
    },
    vehicleType: {
      type: String,
      enum: ['sedan', 'suv', 'compact', 'hybrid', 'electric'],
      required: true
    },
    isEcoFriendly: {
      type: Boolean,
      default: false
    },
    fuelEfficiency: Number
  },
  
  // Current Status & Location
  isOnline: {
    type: Boolean,
    default: false
  },
  isAvailable: {
    type: Boolean,
    default: false
  },
  currentLocation: {
    address: String,
    coordinates: {
      latitude: {
        type: Number,
        min: -90,
        max: 90
      },
      longitude: {
        type: Number,
        min: -180,
        max: 180
      }
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  
  // Driver Stats
  totalRides: {
    type: Number,
    default: 0
  },
  totalDistance: {
    type: Number,
    default: 0
  },
  averageRating: {
    type: Number,
    default: 5.0,
    min: 1.0,
    max: 5.0
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  carbonSavedForRiders: {
    type: Number,
    default: 0
  },
  
  // Schedule & Availability
  workingHours: {
    monday: { start: String, end: String, active: { type: Boolean, default: true } },
    tuesday: { start: String, end: String, active: { type: Boolean, default: true } },
    wednesday: { start: String, end: String, active: { type: Boolean, default: true } },
    thursday: { start: String, end: String, active: { type: Boolean, default: true } },
    friday: { start: String, end: String, active: { type: Boolean, default: true } },
    saturday: { start: String, end: String, active: { type: Boolean, default: false } },
    sunday: { start: String, end: String, active: { type: Boolean, default: false } }
  },
  
  // Pilot Program Specific
  isPilotApproved: {
    type: Boolean,
    default: false,
    required: true
  },
  pilotStartDate: {
    type: Date,
    required: true
  },
  pilotNotes: String,
  
  // Account Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'pending'],
    default: 'pending'
  },
  joinDate: {
    type: Date,
    default: Date.now
  },
  lastActive: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Indexes for performance
driverSchema.index({ isOnline: 1, isAvailable: 1, status: 1 })
driverSchema.index({ isPilotApproved: 1, status: 1 })
driverSchema.index({ 'currentLocation.coordinates': '2dsphere' }) // Geospatial index
driverSchema.index({ email: 1 })
driverSchema.index({ phone: 1 })

// Virtual for full name
driverSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`
})

// Virtual for vehicle display name
driverSchema.virtual('vehicleDisplayName').get(function() {
  return `${this.vehicle.color} ${this.vehicle.year} ${this.vehicle.make} ${this.vehicle.model}`
})

// Virtual to check if driver is currently available for rides
driverSchema.virtual('canAcceptRides').get(function() {
  return this.isOnline && 
         this.isAvailable && 
         this.status === 'active' && 
         this.isPilotApproved &&
         this.backgroundCheckStatus === 'approved'
})

// Instance method to update location
driverSchema.methods.updateLocation = function(latitude: number, longitude: number, address?: string) {
  this.currentLocation = {
    coordinates: { latitude, longitude },
    address,
    lastUpdated: new Date()
  }
  this.lastActive = new Date()
  return this.save()
}

// Instance method to go online/offline
driverSchema.methods.setOnlineStatus = function(isOnline: boolean, isAvailable: boolean = false) {
  this.isOnline = isOnline
  this.isAvailable = isOnline ? isAvailable : false
  this.lastActive = new Date()
  return this.save()
}

// Instance method to complete a ride
driverSchema.methods.completeRide = function(distance: number, earnings: number, carbonSaved: number) {
  this.totalRides += 1
  this.totalDistance += distance
  this.totalEarnings += earnings
  this.carbonSavedForRiders += carbonSaved
  this.lastActive = new Date()
  return this.save()
}

// Static method to find available drivers near location
driverSchema.statics.findAvailableNear = function(latitude: number, longitude: number, maxDistance: number = 5000) {
  return this.find({
    isOnline: true,
    isAvailable: true,
    status: 'active',
    isPilotApproved: true,
    backgroundCheckStatus: 'approved',
    'currentLocation.coordinates': {
      $near: {
        $geometry: { type: 'Point', coordinates: [longitude, latitude] },
        $maxDistance: maxDistance // in meters
      }
    }
  })
}

export default mongoose.models.Driver || mongoose.model<IDriver>('Driver', driverSchema)
