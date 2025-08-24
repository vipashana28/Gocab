'use client'

import { useEffect, useState } from 'react'
import { useGoCabAuth } from '@/lib/auth/use-gocab-auth'
import { useRouter } from 'next/navigation'

interface Event {
  _id: string
  eventId: string
  title: string
  description: string
  shortDescription: string
  category: string
  startDate: string
  endDate: string
  venue: {
    name: string
    address: string
    coordinates: { latitude: number, longitude: number }
  }
  images: {
    thumbnail: string
    banner: string
  }
  organizer: {
    name: string
  }
  ticketing: {
    isTicketed: boolean
    ticketTypes: any[]
  }
  tags: string[]
  ageRestriction: string
  isOutdoor: boolean
  priceRange?: string
  isUpcoming: boolean
  isPast: boolean
  isHappeningNow: boolean
}

export default function EventsPage() {
  const { isAuthenticated, user } = useGoCabAuth()
  const router = useRouter()
  
  const [events, setEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [showUpcomingOnly, setShowUpcomingOnly] = useState(true)

  const categories = [
    'music', 'sports', 'conference', 'festival', 'community', 'food', 'arts', 'technology', 'other'
  ]

  // Fetch events
  useEffect(() => {
    const fetchEvents = async () => {
      setIsLoading(true)
      
      try {
        const params = new URLSearchParams()
        if (selectedCategory) params.append('category', selectedCategory)
        if (showUpcomingOnly) params.append('upcoming', 'true')
        if (searchTerm) params.append('search', searchTerm)
        params.append('limit', '50')
        
        const response = await fetch(`/api/events?${params.toString()}`)
        const data = await response.json()
        
        if (data.success) {
          setEvents(data.data)
        } else {
          console.error('Failed to fetch events:', data.error)
        }
      } catch (error) {
        console.error('Error fetching events:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchEvents()
  }, [selectedCategory, showUpcomingOnly, searchTerm])

  const handleBookRideToEvent = (event: Event) => {
    if (!isAuthenticated) {
      alert('Please sign in to book a ride')
      router.push('/')
      return
    }
    
    // In a real app, this would pre-fill the destination with the event venue
    router.push(`/dashboard?destination=${encodeURIComponent(event.venue.address)}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">🎉 Event Discovery</h1>
              <p className="text-gray-600 mt-1">Find events and book rides to get there</p>
            </div>
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => router.push('/')}
                className="text-primary-600 hover:text-primary-700"
              >
                Home
              </button>
              {isAuthenticated && (
                <button 
                  onClick={() => router.push('/dashboard')}
                  className="btn-primary"
                >
                  Dashboard
                </button>
              )}
            </div>
          </div>

          {/* Search and Filters */}
          <div className="grid md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <input
                type="text"
                placeholder="Search events..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            
            <div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={showUpcomingOnly}
                  onChange={(e) => setShowUpcomingOnly(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Upcoming only</span>
              </label>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading events...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No events found</h3>
            <p className="text-gray-600">
              {searchTerm || selectedCategory ? 
                'Try adjusting your search filters' : 
                'No events are currently available'
              }
            </p>
            {(searchTerm || selectedCategory || !showUpcomingOnly) && (
              <button
                onClick={() => {
                  setSearchTerm('')
                  setSelectedCategory('')
                  setShowUpcomingOnly(true)
                }}
                className="mt-4 text-primary-600 hover:text-primary-700"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <div key={event._id} className="card hover:shadow-lg transition-shadow">
                {/* Event Image */}
                <div className="h-48 bg-gray-200 rounded-lg mb-4 flex items-center justify-center">
                  {event.images.thumbnail ? (
                    <img 
                      src={event.images.thumbnail} 
                      alt={event.title}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <div className="text-4xl">🎭</div>
                  )}
                </div>

                {/* Event Info */}
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                      {event.title}
                    </h3>
                    <span className="bg-primary-100 text-primary-800 text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ml-2">
                      {event.category}
                    </span>
                  </div>

                  <p className="text-gray-600 text-sm line-clamp-3">
                    {event.shortDescription}
                  </p>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center text-gray-600">
                      <span className="mr-2">📅</span>
                      {new Date(event.startDate).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </div>

                    <div className="flex items-center text-gray-600">
                      <span className="mr-2">📍</span>
                      <span className="line-clamp-1">{event.venue.name}</span>
                    </div>

                    <div className="flex items-center text-gray-600">
                      <span className="mr-2">🏢</span>
                      <span className="line-clamp-1">{event.organizer.name}</span>
                    </div>

                    {event.priceRange && (
                      <div className="flex items-center text-gray-600">
                        <span className="mr-2">💰</span>
                        <span>{event.priceRange}</span>
                      </div>
                    )}
                  </div>

                  {/* Event Status */}
                  <div className="flex items-center justify-between">
                    <div>
                      {event.isHappeningNow && (
                        <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
                          🔴 Live Now
                        </span>
                      )}
                      {event.isUpcoming && !event.isHappeningNow && (
                        <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
                          📅 Upcoming
                        </span>
                      )}
                      {event.isPast && (
                        <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2 py-1 rounded-full">
                          ⏰ Past
                        </span>
                      )}
                    </div>
                    
                    {event.ageRestriction !== 'all-ages' && (
                      <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-1 rounded-full">
                        {event.ageRestriction}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-4 border-t space-y-2">
                    <button
                      onClick={() => handleBookRideToEvent(event)}
                      disabled={event.isPast}
                      className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                        event.isPast 
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'btn-primary'
                      }`}
                    >
                      {event.isPast ? 'Event Ended' : '🚗 Book Ride to Event'}
                    </button>

                    <div className="flex space-x-2">
                      <button className="flex-1 bg-gray-100 text-gray-700 hover:bg-gray-200 py-2 px-4 rounded-lg text-sm font-medium transition-colors">
                        📋 Details
                      </button>
                      <button className="flex-1 bg-gray-100 text-gray-700 hover:bg-gray-200 py-2 px-4 rounded-lg text-sm font-medium transition-colors">
                        💙 Save
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Sample Events Button (for development) */}
        <div className="mt-12 text-center">
          <button
            onClick={async () => {
              const sampleEvent = {
                title: 'Sample Music Festival',
                description: 'A great music festival with local bands and food trucks. Perfect for a weekend getaway with friends and family.',
                shortDescription: 'Local music festival with food trucks',
                category: 'music',
                startDate: new Date(Date.now() + 86400000 * 7).toISOString(), // 7 days from now
                endDate: new Date(Date.now() + 86400000 * 7 + 3600000 * 6).toISOString(), // 6 hours later
                venue: {
                  name: 'Central Park',
                  address: '123 Main St, Your City',
                  coordinates: { latitude: 40.7589, longitude: -73.9851 }
                },
                organizer: {
                  name: 'Music Events Co',
                  email: 'events@musicevents.com'
                },
                createdBy: 'admin'
              }
              
              const response = await fetch('/api/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sampleEvent)
              })
              
              if (response.ok) {
                window.location.reload()
              }
            }}
            className="bg-green-100 text-green-800 hover:bg-green-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            🧪 Create Sample Event (Dev)
          </button>
        </div>
      </div>
    </div>
  )
}
