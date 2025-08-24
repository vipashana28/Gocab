import { NextRequest, NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { Event } from '@/lib/models'

export async function GET(request: NextRequest) {
  try {
    await connectDB()
    
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const featured = searchParams.get('featured')
    const upcoming = searchParams.get('upcoming')
    const search = searchParams.get('search')
    const latitude = searchParams.get('lat')
    const longitude = searchParams.get('lng')
    const maxDistance = parseInt(searchParams.get('maxDistance') || '50000') // 50km default
    const limit = parseInt(searchParams.get('limit') || '20')

    let query: any = {
      status: 'published',
      isPublic: true
    }
    
    // Filter by category
    if (category) {
      query.category = category
    }
    
    // Filter by featured status
    if (featured === 'true') {
      query.isFeatured = true
    }
    
    // Filter by upcoming events
    if (upcoming === 'true') {
      query.startDate = { $gte: new Date() }
    }

    let events
    
    // Text search
    if (search) {
      query.$text = { $search: search }
      events = await Event.find(query, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' }, startDate: 1 })
        .limit(limit)
    }
    // Location-based search
    else if (latitude && longitude) {
      const lat = parseFloat(latitude)
      const lng = parseFloat(longitude)
      
      events = await Event.find({
        ...query,
        'venue.coordinates': {
          $near: {
            $geometry: { type: 'Point', coordinates: [lng, lat] },
            $maxDistance: maxDistance
          }
        }
      }).sort({ startDate: 1 }).limit(limit)
    }
    // General search
    else {
      if (upcoming === 'true') {
        events = await Event.find(query).sort({ startDate: 1 }).limit(limit)
      } else {
        events = await Event.find(query).sort({ createdAt: -1 }).limit(limit)
      }
    }

    // Add computed fields
    const eventsWithComputedFields = events.map(event => ({
      ...event.toObject(),
      slug: event.slug,
      isHappeningNow: event.isHappeningNow,
      isUpcoming: event.isUpcoming,
      isPast: event.isPast,
      availableTickets: event.availableTickets,
      priceRange: event.priceRange
    }))

    return NextResponse.json({
      success: true,
      data: eventsWithComputedFields,
      meta: {
        total: events.length,
        limit,
        query
      }
    })

  } catch (error) {
    console.error('Get events error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'DATABASE_ERROR', 
          message: 'Failed to fetch events' 
        } 
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB()
    
    const body = await request.json()
    const {
      title,
      description,
      shortDescription,
      category,
      startDate,
      endDate,
      venue,
      images,
      organizer,
      ticketing = { isTicketed: false, ticketTypes: [] },
      tags = [],
      ageRestriction = 'all-ages',
      isOutdoor = false,
      createdBy
    } = body

    // Validate required fields
    if (!title || !description || !shortDescription || !category || !startDate || !endDate || !venue || !organizer || !createdBy) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'MISSING_REQUIRED_FIELDS', 
            message: 'Missing required event information' 
          } 
        },
        { status: 400 }
      )
    }

    // Validate venue structure
    if (!venue.name || !venue.address || !venue.coordinates) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'INVALID_VENUE_DATA', 
            message: 'Venue must have name, address, and coordinates' 
          } 
        },
        { status: 400 }
      )
    }

    // Validate dates
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    if (start >= end) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'INVALID_DATES', 
            message: 'Start date must be before end date' 
          } 
        },
        { status: 400 }
      )
    }

    // Generate unique event ID
    const eventId = 'EVT_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6).toUpperCase()

    // Calculate duration in minutes
    const duration = Math.floor((end.getTime() - start.getTime()) / (1000 * 60))

    // Create new event
    const event = new Event({
      eventId,
      title,
      description,
      shortDescription,
      category,
      startDate: start,
      endDate: end,
      timezone: 'America/New_York', // TODO: Make this configurable
      duration,
      venue: {
        ...venue,
        accessibility: {
          wheelchairAccessible: venue.accessibility?.wheelchairAccessible || false,
          publicTransport: venue.accessibility?.publicTransport || false,
          parkingAvailable: venue.accessibility?.parkingAvailable || false,
          notes: venue.accessibility?.notes || ''
        }
      },
      images: {
        thumbnail: images?.thumbnail || '/images/event-placeholder.jpg',
        banner: images?.banner || '/images/event-banner-placeholder.jpg',
        gallery: images?.gallery || []
      },
      organizer,
      ticketing: {
        isTicketed: ticketing.isTicketed,
        ticketTypes: ticketing.ticketTypes || [],
        qrVerification: {
          enabled: false,
          verifiedTickets: []
        }
      },
      status: 'published', // Auto-publish for pilot
      isPublic: true,
      isFeatured: false,
      publishedAt: new Date(),
      tags,
      ageRestriction,
      isOutdoor,
      metrics: {
        views: 0,
        interested: 0,
        attending: 0
      },
      rideIntegration: {
        offerRideDiscount: false // Can be enabled later
      },
      createdBy
    })

    await event.save()

    // Return event data with computed fields
    const eventData = {
      ...event.toObject(),
      slug: event.slug,
      isHappeningNow: event.isHappeningNow,
      isUpcoming: event.isUpcoming,
      isPast: event.isPast,
      availableTickets: event.availableTickets,
      priceRange: event.priceRange
    }

    return NextResponse.json({
      success: true,
      data: eventData,
      message: 'Event created successfully'
    })

  } catch (error) {
    console.error('Create event error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'DATABASE_ERROR', 
          message: 'Failed to create event' 
        } 
      },
      { status: 500 }
    )
  }
}
