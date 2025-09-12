import mongoose from 'mongoose'

export interface IRide extends mongoose.Document {
  // References
  userId: mongoose.Types.ObjectId
  driverId?: mongoose.Types.ObjectId
  
  // Ride Identification
  rideId: string
  pickupCode: string // 6-digit code for verification
  otp: string // 4-digit OTP shared between rider and driver
  
  // Locations
  pickup: {
    address: string
    coordinates: {
      latitude: number
      longitude: number
    }
    placeId?: string // Google Places ID
  }
  destination: {
    address: string
    coordinates: {
      latitude: number
      longitude: number
    }
    placeId?: string // Google Places ID
  }
  
  // Route Information
  route: {
    distance: number // in miles
    estimatedDuration: number // in minutes
    estimatedFare: number
    actualDistance?: number
    actualDuration?: number
    actualFare?: number
    polyline?: string // encoded polyline for route display
  }
  
  // Ride Status & Timing
  status: 'requested' | 'matched' | 'driver_en_route' | 'arrived' | 'in_progress' | 'completed' | 'cancelled'
  requestedAt: Date
  matchedAt?: Date
  driverEnRouteAt?: Date
  arrivedAt?: Date
  startedAt?: Date
  completedAt?: Date
  cancelledAt?: Date
  
  // Waiting Time Information
  waitingTime?: {
    requestedAt: Date
    estimatedWaitMinutes: number
    maxWaitMinutes: number
  }
  
  // Driver Communication
  driverContact?: {
    phone: string
    name: string
    vehicleInfo: string
    licensePlate: string
  }
  
  // Real-time Tracking
  driverLocation?: {
    coordinates: {
      latitude: number
      longitude: number
    }
    heading?: number // direction in degrees
    lastUpdated: Date
  }
  
  // Carbon Footprint
  carbonFootprint: {
    estimatedSaved: number // kg CO2 saved vs personal vehicle
    actualSaved?: number // calculated after completion
    comparisonMethod: string // e.g., "vs private car", "vs taxi"
    calculationMethod: string // e.g., "EPA standard", "Climatiq API"
  }
  
  // Pricing & Payment
  pricing: {
    baseFare: number
    distanceFee: number
    timeFee: number
    totalEstimated: number
    totalActual?: number
    currency: string
    isSponsored: boolean
    sponsorshipApplied?: number
  }
  
  // User Experience
  userNotes?: string
  driverNotes?: string
  specialRequests?: string[]
  
  // Ratings & Feedback (post-ride)
  userRating?: {
    rating: number // 1-5 stars
    feedback?: string
    submittedAt: Date
  }
  driverRating?: {
    rating: number // 1-5 stars  
    feedback?: string
    submittedAt: Date
  }
  
  // Cancellation Info
  cancellationReason?: string
  cancelledBy?: 'user' | 'driver' | 'system'
  cancellationFee?: number
  
  // Metadata
  platform: string // e.g., "web", "mobile"
  appVersion?: string
}

const rideSchema = new mongoose.Schema<IRide>({
  // References
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  
  // Ride Identification
  rideId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  pickupCode: {
    type: String,
    required: true,
    length: 6,
    match: /^[0-9]{6}$/ // 6-digit numeric code
  },
  otp: {
    type: String,
    required: true,
    length: 4,
    match: /^[0-9]{4}$/ // 4-digit OTP
  },
  
  // Locations
  pickup: {
    address: {
      type: String,
      required: true
    },
    coordinates: {
      latitude: {
        type: Number,
        required: true,
        min: -90,
        max: 90
      },
      longitude: {
        type: Number,
        required: true,
        min: -180,
        max: 180
      }
    },
    placeId: String
  },
  destination: {
    address: {
      type: String,
      required: true
    },
    coordinates: {
      latitude: {
        type: Number,
        required: true,
        min: -90,
        max: 90
      },
      longitude: {
        type: Number,
        required: true,
        min: -180,
        max: 180
      }
    },
    placeId: String
  },
  
  // Route Information
  route: {
    distance: {
      type: Number,
      required: true,
      min: 0
    },
    estimatedDuration: {
      type: Number,
      required: true,
      min: 0
    },
    estimatedFare: {
      type: Number,
      required: true,
      min: 0
    },
    actualDistance: Number,
    actualDuration: Number,
    actualFare: Number,
    polyline: String
  },
  
  // Ride Status & Timing
  status: {
    type: String,
    enum: ['requested', 'matched', 'driver_en_route', 'arrived', 'in_progress', 'completed', 'cancelled'],
    default: 'requested',
    required: true,
    index: true
  },
  requestedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  matchedAt: Date,
  driverEnRouteAt: Date,
  arrivedAt: Date,
  startedAt: Date,
  completedAt: Date,
  cancelledAt: Date,
  
  // Waiting Time Information
  waitingTime: {
    requestedAt: {
      type: Date,
      default: Date.now
    },
    estimatedWaitMinutes: {
      type: Number,
      min: 1,
      max: 60
    },
    maxWaitMinutes: {
      type: Number,
      min: 1,
      max: 60,
      default: 10
    }
  },
  
  // Driver Communication
  driverContact: {
    phone: String,
    name: String,
    vehicleInfo: String,
    licensePlate: String
  },
  
  // Real-time Tracking
  driverLocation: {
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    heading: Number,
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  
  // Carbon Footprint
  carbonFootprint: {
    estimatedSaved: {
      type: Number,
      required: true,
      min: 0
    },
    actualSaved: Number,
    comparisonMethod: {
      type: String,
      default: 'vs private car'
    },
    calculationMethod: {
      type: String,
      default: 'EPA standard'
    }
  },
  
  // Pricing & Payment
  pricing: {
    baseFare: {
      type: Number,
      required: true,
      min: 0
    },
    distanceFee: {
      type: Number,
      required: true,
      min: 0
    },
    timeFee: {
      type: Number,
      required: true,
      min: 0
    },
    totalEstimated: {
      type: Number,
      required: true,
      min: 0
    },
    totalActual: Number,
    currency: {
      type: String,
      default: 'USD'
    },
    isSponsored: {
      type: Boolean,
      default: false
    },
    sponsorshipApplied: Number
  },
  
  // User Experience
  userNotes: String,
  driverNotes: String,
  specialRequests: [String],
  
  // Ratings & Feedback
  userRating: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    feedback: String,
    submittedAt: Date
  },
  driverRating: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    feedback: String,
    submittedAt: Date
  },
  
  // Cancellation Info
  cancellationReason: String,
  cancelledBy: {
    type: String,
    enum: ['user', 'driver', 'system']
  },
  cancellationFee: Number,
  
  // Metadata
  platform: {
    type: String,
    default: 'web'
  },
  appVersion: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Indexes for performance
rideSchema.index({ userId: 1, status: 1 })
rideSchema.index({ driverId: 1, status: 1 })
rideSchema.index({ status: 1, requestedAt: -1 })
rideSchema.index({ rideId: 1 })
rideSchema.index({ pickupCode: 1 })
rideSchema.index({ requestedAt: -1 })
rideSchema.index({ completedAt: -1 })

// Virtual for ride duration
rideSchema.virtual('totalDuration').get(function() {
  if (this.completedAt && this.startedAt) {
    return Math.round((this.completedAt.getTime() - this.startedAt.getTime()) / (1000 * 60)) // minutes
  }
  return null
})

// Virtual for wait time (from request to pickup)
rideSchema.virtual('waitTime').get(function() {
  if (this.startedAt && this.requestedAt) {
    return Math.round((this.startedAt.getTime() - this.requestedAt.getTime()) / (1000 * 60)) // minutes
  }
  return null
})

// Virtual for status display
rideSchema.virtual('statusDisplay').get(function() {
  const statusMap: Record<string, string> = {
    'requested': 'Looking for driver...',
    'matched': 'Driver assigned',
    'driver_en_route': 'Driver on the way',
    'arrived': 'Driver has arrived',
    'in_progress': 'Ride in progress',
    'completed': 'Trip completed',
    'cancelled': 'Trip cancelled'
  }
  return statusMap[this.status] || this.status
})

// Instance method to generate pickup code
rideSchema.methods.generatePickupCode = function() {
  this.pickupCode = Math.floor(100000 + Math.random() * 900000).toString()
  return this.pickupCode
}

// Instance method to update ride status
rideSchema.methods.updateStatus = function(newStatus: IRide['status'], additionalData?: any) {
  this.status = newStatus
  
  const timestamp = new Date()
  switch (newStatus) {
    case 'matched':
      this.matchedAt = timestamp
      break
    case 'driver_en_route':
      this.driverEnRouteAt = timestamp
      break
    case 'arrived':
      this.arrivedAt = timestamp
      break
    case 'in_progress':
      this.startedAt = timestamp
      break
    case 'completed':
      this.completedAt = timestamp
      break
    case 'cancelled':
      this.cancelledAt = timestamp
      break
  }
  
  if (additionalData) {
    Object.assign(this, additionalData)
  }
  
  return this.save()
}

// Instance method to update driver location
rideSchema.methods.updateDriverLocation = function(latitude: number, longitude: number, heading?: number) {
  this.driverLocation = {
    coordinates: { latitude, longitude },
    heading,
    lastUpdated: new Date()
  }
  return this.save()
}

// Static method to find active rides for a user
rideSchema.statics.findActiveRidesForUser = function(userId: string) {
  return this.find({
    userId,
    status: { $in: ['requested', 'matched', 'driver_en_route', 'arrived', 'in_progress'] }
  }).populate('driverId', 'firstName lastName phone vehicle')
}

// Static method to find rides for a driver
rideSchema.statics.findRidesForDriver = function(driverId: string, status?: string[]) {
  const query: any = { driverId }
  if (status) {
    query.status = { $in: status }
  }
  return this.find(query).populate('userId', 'firstName lastName phone')
}

export default mongoose.models.Ride || mongoose.model<IRide>('Ride', rideSchema)
