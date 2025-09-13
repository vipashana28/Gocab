'use client'

import { useEffect, useState } from 'react'
import { useGoCabAuth } from '@/lib/auth/use-gocab-auth-google'
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

// Helper functions for Luma links and partner handles
const getEventLumaLink = (eventId: string): string => {
  const lumaLinks: { [key: string]: string } = {
    'startup-village-sep29': 'https://luma.com/startup_village_sg',
    'token2049-sep29': 'https://luma.com/kgkuizrv',
    'sep30-networking': 'https://luma.com/s26lk0zj',
    'oct02-depin': 'https://luma.com/bi1r8d5l'
  }
  return lumaLinks[eventId] || 'https://luma.com'
}

const getEventPartnerHandle = (eventId: string): string => {
  const partnerHandles: { [key: string]: string } = {
    'startup-village-sep29': 'SuperteamSG',
    'token2049-sep29': 'SuperteamSG',
    'sep30-networking': 'SuperteamSG',
    'oct02-depin': 'SEADePIN'
  }
  return partnerHandles[eventId] || 'SuperteamSG'
}

export default function EventsPage() {
  const { isAuthenticated, user } = useGoCabAuth()
  const router = useRouter()
  
  const [events, setEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Partner events for September-October 2024
  const partnerEvents: Event[] = [
    {
      _id: '1',
      eventId: 'startup-village-sep29',
      title: 'Startup Village Singapore',
      description: 'Join the vibrant startup ecosystem in Singapore. Connect with entrepreneurs, investors, and industry leaders.',
      shortDescription: 'Singapore startup ecosystem networking event.',
      category: 'conference',
      startDate: '2024-09-29T09:00:00Z',
      endDate: '2024-09-29T18:00:00Z',
      venue: {
        name: 'Singapore Startup Hub',
        address: 'Singapore',
        coordinates: { latitude: 1.3521, longitude: 103.8198 }
      },
      images: {
        thumbnail: 'https://via.placeholder.com/300x200?text=Startup+Village+SG',
        banner: 'https://via.placeholder.com/800x400?text=Startup+Village+Singapore'
      },
      organizer: {
        name: 'Startup Village Singapore'
      },
      ticketing: {
        isTicketed: true,
        ticketTypes: []
      },
      tags: ['Startup', 'Singapore', 'Networking', 'Entrepreneurs'],
      ageRestriction: '18+',
      isOutdoor: false,
      priceRange: 'Register on Luma',
      isUpcoming: true,
      isPast: false,
      isHappeningNow: false
    },
    {
      _id: '2',
      eventId: 'token2049-sep29',
      title: 'Token2049 Side Event',
      description: 'Premium crypto and blockchain networking event during Token2049 week in Singapore.',
      shortDescription: 'Premium crypto networking during Token2049 week.',
      category: 'conference',
      startDate: '2024-09-29T19:00:00Z',
      endDate: '2024-09-29T23:00:00Z',
      venue: {
        name: 'Singapore Conference Center',
        address: 'Singapore',
        coordinates: { latitude: 1.3521, longitude: 103.8198 }
      },
      images: {
        thumbnail: 'https://via.placeholder.com/300x200?text=Token2049+Event',
        banner: 'https://via.placeholder.com/800x400?text=Token2049+Singapore'
      },
      organizer: {
        name: 'Token2049 Partners'
      },
      ticketing: {
        isTicketed: true,
        ticketTypes: []
      },
      tags: ['Crypto', 'Blockchain', 'Token2049', 'Singapore'],
      ageRestriction: '21+',
      isOutdoor: false,
      priceRange: 'Register on Luma',
      isUpcoming: true,
      isPast: false,
      isHappeningNow: false
    },
    {
      _id: '3',
      eventId: 'sep30-networking',
      title: 'Singapore Tech Networking',
      description: 'Connect with the Singapore tech community in an intimate networking setting.',
      shortDescription: 'Singapore tech community networking event.',
      category: 'conference',
      startDate: '2024-09-30T18:00:00Z',
      endDate: '2024-09-30T22:00:00Z',
      venue: {
        name: 'Tech Hub Singapore',
        address: 'Singapore',
        coordinates: { latitude: 1.3521, longitude: 103.8198 }
      },
      images: {
        thumbnail: 'https://via.placeholder.com/300x200?text=Tech+Networking',
        banner: 'https://via.placeholder.com/800x400?text=Singapore+Tech'
      },
      organizer: {
        name: 'Singapore Tech Community'
      },
      ticketing: {
        isTicketed: true,
        ticketTypes: []
      },
      tags: ['Tech', 'Networking', 'Singapore'],
      ageRestriction: '18+',
      isOutdoor: false,
      priceRange: 'Register on Luma',
      isUpcoming: true,
      isPast: false,
      isHappeningNow: false
    },
    {
      _id: '4',
      eventId: 'oct02-depin',
      title: 'DePIN Summit Singapore',
      description: 'Explore the future of Decentralized Physical Infrastructure Networks with industry leaders and innovators.',
      shortDescription: 'DePIN infrastructure and innovation summit.',
      category: 'conference',
      startDate: '2024-10-02T09:00:00Z',
      endDate: '2024-10-02T17:00:00Z',
      venue: {
        name: 'Marina Bay Convention Centre',
        address: 'Singapore',
        coordinates: { latitude: 1.3521, longitude: 103.8198 }
      },
      images: {
        thumbnail: 'https://via.placeholder.com/300x200?text=DePIN+Summit',
        banner: 'https://via.placeholder.com/800x400?text=DePIN+Singapore'
      },
      organizer: {
        name: 'SEA DePIN'
      },
      ticketing: {
        isTicketed: true,
        ticketTypes: []
      },
      tags: ['DePIN', 'Infrastructure', 'Blockchain', 'Singapore'],
      ageRestriction: '18+',
      isOutdoor: false,
      priceRange: 'Register on Luma',
      isUpcoming: true,
      isPast: false,
      isHappeningNow: false
    }
  ]

  // Load partner events
  useEffect(() => {
    setIsLoading(true)
    
    // Simulate API delay
    setTimeout(() => {
      setEvents(partnerEvents)
      setIsLoading(false)
    }, 500)
  }, [])

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
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-6 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-green-600 rounded-lg p-2">
                <img 
                  src="/icons/GOLOGO.svg" 
                  alt="GoCabs Logo" 
                  className="w-full h-full"
                />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Singapore Tech Events</h1>
                <p className="text-gray-600">Token2049 week & partner events</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {isAuthenticated && (
                <button 
                  onClick={() => router.push('/dashboard')}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Dashboard
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Partners Section */}
      <div className="bg-green-50 border-b border-green-100">
        <div className="container mx-auto px-6 py-12">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Our Partners</h2>
            <p className="text-gray-600 text-lg">Connecting Singapore's premier tech events</p>
          </div>

          {/* Premium Sponsor */}
          <div className="mb-12">
            <h3 className="text-xl font-semibold mb-6 text-center text-gray-800">Premium Sponsor</h3>
            <div className="flex justify-center">
              <a 
                href="https://x.com/DeCharge__" 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-white border-2 border-green-200 hover:border-green-300 rounded-xl p-8 transition-all hover:shadow-xl transform hover:scale-105"
              >
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
                    <img 
                      src="/icons/Decharge.jpg" 
                      alt="Decharge Logo" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-xl text-gray-900">Decharge</div>
                    <div className="text-sm text-gray-500 mt-1">Premium Sponsor</div>
                  </div>
                </div>
              </a>
            </div>
          </div>
          
          {/* Partners Grid */}
          <div>
            <h3 className="text-xl font-semibold mb-8 text-center text-gray-800">Event Partners</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
              <a 
                href="https://x.com/SuperteamSG" 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-white border border-gray-200 hover:border-green-300 hover:shadow-lg rounded-lg p-6 text-center transition-all group transform hover:scale-105"
              >
                <div className="mb-4">
                  <div className="w-16 h-16 mx-auto rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
                    <img 
                      src="/icons/ST_singapore.jpg" 
                      alt="Superteam Singapore Logo" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                <div className="font-semibold text-gray-900 group-hover:text-green-700">
                  Superteam Singapore
                </div>
                <div className="text-sm text-gray-500 mt-1">@SuperteamSG</div>
              </a>
              
              <a 
                href="https://x.com/SEADePIN" 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-white border border-gray-200 hover:border-green-300 hover:shadow-lg rounded-lg p-6 text-center transition-all group transform hover:scale-105"
              >
                <div className="mb-4">
                  <div className="w-16 h-16 mx-auto rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
                    <img 
                      src="/icons/SeaDEpin.jpg" 
                      alt="SEA DePIN Logo" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                <div className="font-semibold text-gray-900 group-hover:text-green-700">
                  SEA DePIN
                </div>
                <div className="text-sm text-gray-500 mt-1">@SEADePIN</div>
              </a>
              
              <a 
                href="https://x.com/BackersStage" 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-white border border-gray-200 hover:border-green-300 hover:shadow-lg rounded-lg p-6 text-center transition-all group transform hover:scale-105"
              >
                <div className="mb-4">
                  <div className="w-16 h-16 mx-auto rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
                    <img 
                      src="/icons/Backersstage.jpg" 
                      alt="BackerStage Logo" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                <div className="font-semibold text-gray-900 group-hover:text-green-700">
                  BackerStage
                </div>
                <div className="text-sm text-gray-500 mt-1">@BackersStage</div>
              </a>

              {/* <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
                <div className="mb-4">
                  <div className="w-16 h-16 mx-auto rounded-lg bg-green-100 flex items-center justify-center">
                    <img 
                      src="/icons/GOLOGO.svg" 
                      alt="GoCabs Logo" 
                      className="w-10 h-10"
                    />
                  </div>
                </div>
                <div className="font-semibold text-gray-900">
                  GoCabs
                </div>
                <div className="text-sm text-gray-500 mt-1">Ride Partner</div>
              </div> */}
            </div>
          </div>
        </div>
      </div>

      {/* Events Section */}
      <div className="container mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Featured Events</h2>
          <p className="text-gray-600 text-lg">Token2049 week events in Singapore</p>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-green-600 border-t-transparent mx-auto mb-4"></div>
            <p className="text-gray-600">Loading events...</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {events.map((event) => (
              <div key={event._id} className="bg-white border border-gray-200 hover:border-green-300 hover:shadow-lg rounded-lg overflow-hidden transition-all">
                {/* Event Image */}
                <div className="h-48 bg-green-50 flex items-center justify-center">
                  {event.images.thumbnail ? (
                    <img 
                      src={event.images.thumbnail} 
                      alt={event.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center text-green-600">
                      <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 4l6 6m0-6l-6 6" />
                      </svg>
                      <p className="font-medium">Tech Event</p>
                    </div>
                  )}
                </div>

                {/* Event Info */}
                <div className="p-6 space-y-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {event.title}
                    </h3>
                    <p className="text-gray-600 text-sm">
                      {event.shortDescription}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center text-gray-700">
                      <svg className="w-4 h-4 mr-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 4l6 6m0-6l-6 6" />
                      </svg>
                      <span className="text-sm font-medium">
                        {new Date(event.startDate).toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long', 
                          day: 'numeric'
                        })}
                      </span>
                    </div>

                    <div className="flex items-center text-gray-700">
                      <svg className="w-4 h-4 mr-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-sm">{event.venue.name}</span>
                    </div>

                    <div className="flex items-center text-gray-700">
                      <svg className="w-4 h-4 mr-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span className="text-sm">{event.organizer.name}</span>
                    </div>
                  </div>

                  {/* Event Status */}
                  <div className="flex items-center justify-between py-2">
                    <div>
                      {event.isUpcoming && (
                        <span className="bg-green-100 text-green-800 text-xs font-medium px-3 py-1 rounded-full border border-green-200">
                          Upcoming
                        </span>
                      )}
                    </div>
                    
                    {event.ageRestriction !== 'all-ages' && (
                      <span className="bg-gray-100 text-gray-800 text-xs font-medium px-3 py-1 rounded-full border border-gray-200">
                        {event.ageRestriction}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-4 border-t border-gray-100 space-y-3">
                    <button
                      onClick={() => handleBookRideToEvent(event)}
                      disabled={event.isPast}
                      className={`w-full py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center space-x-2 ${
                        event.isPast 
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-green-600 hover:bg-green-700 text-white'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 12h-6m0 0L9 8m4 4l-4 4" />
                      </svg>
                      <span>{event.isPast ? 'Event Ended' : 'Book Ride'}</span>
                    </button>

                    <div className="grid grid-cols-2 gap-3">
                      <a
                        href={getEventLumaLink(event.eventId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center space-x-2 bg-white border border-green-600 text-green-600 hover:bg-green-50 py-2 px-4 rounded-lg text-sm font-medium transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 4l6 6m0-6l-6 6" />
                        </svg>
                        <span>Register</span>
                      </a>
                      <button 
                        onClick={() => {
                          const partnerHandle = getEventPartnerHandle(event.eventId)
                          if (partnerHandle) {
                            window.open(`https://x.com/${partnerHandle}`, '_blank')
                          }
                        }}
                        className="flex items-center justify-center space-x-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 py-2 px-4 rounded-lg text-sm font-medium transition-all"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                        </svg>
                        <span>Follow</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
