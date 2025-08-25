import mongoose from 'mongoose'

export interface IUser extends mongoose.Document {
  // Google Auth Data
  googleId: string
  email: string
  
  // Profile Information
  firstName: string
  lastName: string
  phone?: string
  profilePicture?: string
  
  // App-specific Data
  isSponsored: boolean
  sponsorshipDetails?: {
    sponsorName: string
    validUntil: Date
    maxRides: number
    usedRides: number
  }
  
  // Location Preferences
  defaultLocation?: {
    address: string
    coordinates: {
      latitude: number
      longitude: number
    }
  }
  
  // Ride History & Stats
  totalRides: number
  totalCarbonSaved: number // in kg CO2
  memberSince: Date
  lastActive: Date
  
  // App Preferences
  preferences: {
    notifications: boolean
    shareLocation: boolean
    preferredPaymentMethod?: string
  }
  
  // Account Status
  isActive: boolean
  isVerified: boolean
}

const userSchema = new mongoose.Schema<IUser>({
  // Google Auth Data
  googleId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  
  // Profile Information
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
  phone: {
    type: String,
    trim: true
  },
  profilePicture: String,
  
  // App-specific Data
  isSponsored: {
    type: Boolean,
    default: false
  },
  sponsorshipDetails: {
    sponsorName: String,
    validUntil: Date,
    maxRides: {
      type: Number,
      default: 0
    },
    usedRides: {
      type: Number,
      default: 0
    }
  },
  
  // Location Preferences
  defaultLocation: {
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
    }
  },
  
  // Ride History & Stats
  totalRides: {
    type: Number,
    default: 0
  },
  totalCarbonSaved: {
    type: Number,
    default: 0
  },
  memberSince: {
    type: Date,
    default: Date.now
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  
  // App Preferences
  preferences: {
    notifications: {
      type: Boolean,
      default: true
    },
    shareLocation: {
      type: Boolean,
      default: true
    },
    preferredPaymentMethod: String
  },
  
  // Account Status
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Indexes for performance
userSchema.index({ email: 1, isActive: 1 })
userSchema.index({ isSponsored: 1, isActive: 1 })
userSchema.index({ lastActive: -1 })

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`
})

// Virtual for sponsorship status
userSchema.virtual('sponsorshipStatus').get(function() {
  if (!this.isSponsored || !this.sponsorshipDetails) return 'none'
  
  const now = new Date()
  if (this.sponsorshipDetails.validUntil < now) return 'expired'
  if (this.sponsorshipDetails.usedRides >= this.sponsorshipDetails.maxRides) return 'exhausted'
  return 'active'
})

// Instance method to update last active
userSchema.methods.updateLastActive = function() {
  this.lastActive = new Date()
  return this.save()
}

// Instance method to increment ride count
userSchema.methods.completeRide = function(carbonSaved: number) {
  this.totalRides += 1
  this.totalCarbonSaved += carbonSaved
  if (this.isSponsored && this.sponsorshipDetails) {
    this.sponsorshipDetails.usedRides += 1
  }
  this.lastActive = new Date()
  return this.save()
}

export default mongoose.models.User || mongoose.model<IUser>('User', userSchema)
