import mongoose from 'mongoose'

export interface IEvent extends mongoose.Document {
  // Basic Event Information
  eventId: string
  title: string
  description: string
  shortDescription: string
  category: 'music' | 'sports' | 'conference' | 'festival' | 'community' | 'food' | 'arts' | 'technology' | 'other'
  
  // Event Timing
  startDate: Date
  endDate: Date
  timezone: string
  duration?: number // in minutes
  
  // Location
  venue: {
    name: string
    address: string
    coordinates: {
      latitude: number
      longitude: number
    }
    capacity?: number
    accessibility: {
      wheelchairAccessible: boolean
      publicTransport: boolean
      parkingAvailable: boolean
      notes?: string
    }
  }
  
  // Event Media
  images: {
    thumbnail: string
    banner: string
    gallery?: string[]
  }
  
  // Organizer Information
  organizer: {
    name: string
    email: string
    phone?: string
    website?: string
    logo?: string
    socialMedia?: {
      facebook?: string
      twitter?: string
      instagram?: string
    }
  }
  
  // Ticketing & QR Verification
  ticketing: {
    isTicketed: boolean
    ticketTypes: {
      type: string // e.g., "general", "vip", "student"
      price: number
      currency: string
      available: number
      sold: number
      maxPerPerson: number
      salesStart?: Date
      salesEnd?: Date
    }[]
    qrVerification: {
      enabled: boolean
      secretKey?: string
      verifiedTickets: {
        ticketId: string
        qrCode: string
        verifiedAt: Date
        verifiedBy?: string
        attendeeInfo?: {
          name: string
          email: string
          phone?: string
        }
      }[]
    }
  }
  
  // Event Status & Visibility
  status: 'draft' | 'published' | 'cancelled' | 'postponed' | 'completed'
  isPublic: boolean
  isFeatured: boolean
  publishedAt?: Date
  
  // Filtering & Search
  tags: string[]
  ageRestriction: 'all-ages' | '18+' | '21+' | 'family-friendly'
  
  // Weather Considerations (for outdoor events)
  isOutdoor: boolean
  weatherBackupPlan?: string
  
  // Event Metrics
  metrics: {
    views: number
    interested: number
    attending: number
    actualAttendance?: number
    lastViewedAt?: Date
  }
  
  // Additional Information
  additionalInfo?: {
    dresscode?: string
    whatToBring?: string[]
    prohibited?: string[]
    specialInstructions?: string
    covidGuidelines?: string
  }
  
  // Integration with Ride Service
  rideIntegration: {
    offerRideDiscount: boolean
    discountPercentage?: number
    partnershipCode?: string
    estimatedRideTime?: number // minutes from common locations
    suggestedArrivalTime?: string // e.g., "30 minutes before start"
  }
  
  // Timestamps
  createdBy: string
  updatedBy?: string
}

const eventSchema = new mongoose.Schema<IEvent>({
  // Basic Event Information
  eventId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 5000
  },
  shortDescription: {
    type: String,
    required: true,
    maxlength: 300
  },
  category: {
    type: String,
    enum: ['music', 'sports', 'conference', 'festival', 'community', 'food', 'arts', 'technology', 'other'],
    required: true,
    index: true
  },
  
  // Event Timing
  startDate: {
    type: Date,
    required: true,
    index: true
  },
  endDate: {
    type: Date,
    required: true
  },
  timezone: {
    type: String,
    required: true,
    default: 'America/New_York'
  },
  duration: Number,
  
  // Location
  venue: {
    name: {
      type: String,
      required: true
    },
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
    capacity: Number,
    accessibility: {
      wheelchairAccessible: {
        type: Boolean,
        default: false
      },
      publicTransport: {
        type: Boolean,
        default: false
      },
      parkingAvailable: {
        type: Boolean,
        default: false
      },
      notes: String
    }
  },
  
  // Event Media
  images: {
    thumbnail: {
      type: String,
      required: true
    },
    banner: {
      type: String,
      required: true
    },
    gallery: [String]
  },
  
  // Organizer Information
  organizer: {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true
    },
    phone: String,
    website: String,
    logo: String,
    socialMedia: {
      facebook: String,
      twitter: String,
      instagram: String
    }
  },
  
  // Ticketing & QR Verification
  ticketing: {
    isTicketed: {
      type: Boolean,
      default: false
    },
    ticketTypes: [{
      type: {
        type: String,
        required: true
      },
      price: {
        type: Number,
        required: true,
        min: 0
      },
      currency: {
        type: String,
        default: 'USD'
      },
      available: {
        type: Number,
        required: true,
        min: 0
      },
      sold: {
        type: Number,
        default: 0,
        min: 0
      },
      maxPerPerson: {
        type: Number,
        default: 10,
        min: 1
      },
      salesStart: Date,
      salesEnd: Date
    }],
    qrVerification: {
      enabled: {
        type: Boolean,
        default: false
      },
      secretKey: String,
      verifiedTickets: [{
        ticketId: {
          type: String,
          required: true
        },
        qrCode: {
          type: String,
          required: true
        },
        verifiedAt: {
          type: Date,
          required: true
        },
        verifiedBy: String,
        attendeeInfo: {
          name: String,
          email: String,
          phone: String
        }
      }]
    }
  },
  
  // Event Status & Visibility
  status: {
    type: String,
    enum: ['draft', 'published', 'cancelled', 'postponed', 'completed'],
    default: 'draft',
    index: true
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false,
    index: true
  },
  publishedAt: Date,
  
  // Filtering & Search
  tags: {
    type: [String],
    index: true
  },
  ageRestriction: {
    type: String,
    enum: ['all-ages', '18+', '21+', 'family-friendly'],
    default: 'all-ages'
  },
  
  // Weather Considerations
  isOutdoor: {
    type: Boolean,
    default: false
  },
  weatherBackupPlan: String,
  
  // Event Metrics
  metrics: {
    views: {
      type: Number,
      default: 0
    },
    interested: {
      type: Number,
      default: 0
    },
    attending: {
      type: Number,
      default: 0
    },
    actualAttendance: Number,
    lastViewedAt: Date
  },
  
  // Additional Information
  additionalInfo: {
    dresscode: String,
    whatToBring: [String],
    prohibited: [String],
    specialInstructions: String,
    covidGuidelines: String
  },
  
  // Integration with Ride Service
  rideIntegration: {
    offerRideDiscount: {
      type: Boolean,
      default: false
    },
    discountPercentage: {
      type: Number,
      min: 0,
      max: 100
    },
    partnershipCode: String,
    estimatedRideTime: Number,
    suggestedArrivalTime: String
  },
  
  // Timestamps
  createdBy: {
    type: String,
    required: true
  },
  updatedBy: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Indexes for performance and filtering
eventSchema.index({ status: 1, isPublic: 1, startDate: 1 })
eventSchema.index({ category: 1, startDate: 1 })
eventSchema.index({ startDate: 1, endDate: 1 })
eventSchema.index({ isFeatured: -1, startDate: 1 })
eventSchema.index({ tags: 1 })
eventSchema.index({ 'venue.coordinates': '2dsphere' }) // Geospatial index
eventSchema.index({ 'organizer.name': 1 })

// Text index for search functionality
eventSchema.index({
  title: 'text',
  description: 'text',
  shortDescription: 'text',
  'venue.name': 'text',
  'organizer.name': 'text',
  tags: 'text'
})

// Virtual for event URL slug
eventSchema.virtual('slug').get(function() {
  return this.title.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '') + '-' + this.eventId.slice(-6)
})

// Virtual to check if event is happening now
eventSchema.virtual('isHappeningNow').get(function() {
  const now = new Date()
  return now >= this.startDate && now <= this.endDate
})

// Virtual to check if event is upcoming
eventSchema.virtual('isUpcoming').get(function() {
  return new Date() < this.startDate
})

// Virtual to check if event is past
eventSchema.virtual('isPast').get(function() {
  return new Date() > this.endDate
})

// Virtual for available tickets
eventSchema.virtual('availableTickets').get(function() {
  if (!this.ticketing.isTicketed) return null
  
  return this.ticketing.ticketTypes.reduce((total, ticketType) => {
    return total + (ticketType.available - ticketType.sold)
  }, 0)
})

// Virtual for ticket price range
eventSchema.virtual('priceRange').get(function() {
  if (!this.ticketing.isTicketed || this.ticketing.ticketTypes.length === 0) return null
  
  const prices = this.ticketing.ticketTypes.map(t => t.price)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  
  if (minPrice === maxPrice) {
    return minPrice === 0 ? 'Free' : `$${minPrice}`
  }
  return minPrice === 0 ? `Free - $${maxPrice}` : `$${minPrice} - $${maxPrice}`
})

// Instance method to increment view count
eventSchema.methods.incrementViews = function() {
  this.metrics.views += 1
  this.metrics.lastViewedAt = new Date()
  return this.save()
}

// Instance method to verify QR ticket
eventSchema.methods.verifyTicket = function(qrCode: string, ticketId: string, verifiedBy?: string, attendeeInfo?: any) {
  if (!this.ticketing.qrVerification.enabled) {
    throw new Error('QR verification not enabled for this event')
  }
  
  // Check if ticket already verified
  const existingVerification = this.ticketing.qrVerification.verifiedTickets.find(
    (ticket: any) => ticket.ticketId === ticketId
  )
  
  if (existingVerification) {
    throw new Error('Ticket already verified')
  }
  
  // Add to verified tickets
  this.ticketing.qrVerification.verifiedTickets.push({
    ticketId,
    qrCode,
    verifiedAt: new Date(),
    verifiedBy,
    attendeeInfo
  })
  
  return this.save()
}

// Static method to find upcoming events
eventSchema.statics.findUpcoming = function(limit: number = 10, category?: string) {
  const query: any = {
    status: 'published',
    isPublic: true,
    startDate: { $gte: new Date() }
  }
  
  if (category) {
    query.category = category
  }
  
  return this.find(query)
    .sort({ startDate: 1 })
    .limit(limit)
}

// Static method to find events by location
eventSchema.statics.findNearLocation = function(
  latitude: number, 
  longitude: number, 
  maxDistance: number = 50000, // 50km default
  limit: number = 20
) {
  return this.find({
    status: 'published',
    isPublic: true,
    startDate: { $gte: new Date() },
    'venue.coordinates': {
      $near: {
        $geometry: { type: 'Point', coordinates: [longitude, latitude] },
        $maxDistance: maxDistance
      }
    }
  }).limit(limit)
}

// Static method for text search
eventSchema.statics.searchEvents = function(searchText: string, filters?: any) {
  const query: any = {
    $text: { $search: searchText },
    status: 'published',
    isPublic: true,
    startDate: { $gte: new Date() }
  }
  
  if (filters) {
    Object.assign(query, filters)
  }
  
  return this.find(query, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } })
}

export default mongoose.models.Event || mongoose.model<IEvent>('Event', eventSchema)
