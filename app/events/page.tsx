'use client'

import { useEffect, useMemo, useState } from 'react'
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
    thumbnail?: string
    banner?: string
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

const prettyDate = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

function useCountdown(targetISO?: string) {
  const [now, setNow] = useState<number>(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const diff = targetISO ? Math.max(0, +new Date(targetISO) - now) : 0
  const s = Math.floor(diff / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return { d, h, m, sec, isOver: diff <= 0 }
}

export default function EventsPage() {
  const { isAuthenticated } = useGoCabAuth()
  const router = useRouter()

  const [events, setEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Partner events for September-October 2024 (sample)
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
      images: { thumbnail: '', banner: '' },
      organizer: { name: 'Startup Village Singapore' },
      ticketing: { isTicketed: true, ticketTypes: [] },
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
      title: 'TOKEN2049 Side Event',
      description: 'Premium crypto and blockchain networking event during TOKEN2049 week in Singapore.',
      shortDescription: 'Premium crypto networking during TOKEN2049 week.',
      category: 'conference',
      startDate: '2024-09-29T19:00:00Z',
      endDate: '2024-09-29T23:00:00Z',
      venue: {
        name: 'Singapore Conference Center',
        address: 'Singapore',
        coordinates: { latitude: 1.3521, longitude: 103.8198 }
      },
      images: { thumbnail: '', banner: '' },
      organizer: { name: 'TOKEN2049 Partners' },
      ticketing: { isTicketed: true, ticketTypes: [] },
      tags: ['Crypto', 'Blockchain', 'TOKEN2049', 'Singapore'],
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
      images: { thumbnail: '', banner: '' },
      organizer: { name: 'Singapore Tech Community' },
      ticketing: { isTicketed: true, ticketTypes: [] },
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
      images: { thumbnail: '', banner: '' },
      organizer: { name: 'SEA DePIN' },
      ticketing: { isTicketed: true, ticketTypes: [] },
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
    const t = setTimeout(() => {
      setEvents(partnerEvents)
      setIsLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [])

  const handleBookRideToEvent = (event: Event) => {
    if (!isAuthenticated) {
      alert('Please sign in to book a ride')
      router.push('/')
      return
    }
    router.push(`/dashboard?destination=${encodeURIComponent(event.venue.address)}`)
  }

  const list = useMemo(
    () => [...events].sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate)),
    [events]
  )

  // CTA micro-burst
  const triggerBurst = (id: string) => {
    const btn = document.getElementById(id)
    if (!btn) return
    btn.classList.remove('after:opacity-0', 'after:scale-50')
    btn.classList.add('after:opacity-100', 'after:scale-100')
    setTimeout(() => {
      btn.classList.add('after:opacity-0')
      btn.classList.remove('after:opacity-100')
    }, 350)
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Top nav */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-white rounded-lg flex items-center justify-center shadow-sm ring-1 ring-neutral-200">
                <img src="/icons/GOLOGO.svg" alt="GoCabs Logo" className="w-full h-full" />
              </div>
              <div className="leading-tight">
                <h1 className="text-lg sm:text-xl md:text-2xl font-semibold tracking-tight">GoCabs Events</h1>
                <p className="text-xs sm:text-sm text-neutral-500">TOKEN2049 • Singapore</p>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              <a
                href="https://x.com/gocabs_xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 sm:gap-2 rounded-full border border-neutral-200 px-2 sm:px-3 md:px-4 py-1 sm:py-1.5 md:py-2 text-xs sm:text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition"
                aria-label="Follow GoCabs on X"
              >
                {/* X icon */}
                <svg viewBox="0 0 24 24" className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2H21l-6.56 7.49L22.5 22h-6.93l-4.52-5.95L5.9 22H3.14l7.02-8.02L1.5 2h7.03l4.07 5.47L18.24 2Zm-1.216 18h1.89L8.05 4h-1.9l10.878 16Z"/>
                </svg>
                <span className="hidden sm:inline">Follow</span>
              </a>

              {isAuthenticated && (
                <button
                  onClick={() => router.push('/dashboard')}
                  className="inline-flex items-center rounded-full bg-neutral-900 text-white px-3 sm:px-4 md:px-5 py-1.5 sm:py-2 md:py-2.5 text-xs sm:text-sm md:text-base font-medium hover:bg-black transition shadow-sm"
                >
                  Dashboard
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-neutral-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight">
              TOKEN 2049
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-neutral-600 max-w-3xl mx-auto">
              Your gateway to premier events during TOKEN 2049. Book eco-friendly rides with one tap.
            </p>

            {/* Moving banner (icons only) */}
            <div className="relative overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
              <div className="flex whitespace-nowrap animate-[marquee_8s_linear_infinite]">
                {[
                  { text: 'Eco-friendly rides', icon: (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M5 11h3l3-7h4a4 4 0 014 4v7h-2a3 3 0 11-6 0H9a3 3 0 11-6 0H1v-2a2 2 0 012-2h2Z"/></svg>
                  )},
                  { text: 'Instant booking', icon: (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H7a2 2 0 00-2 2v3h14V5a2 2 0 00-2-2ZM5 10v7a2 2 0 002 2h10a2 2 0 002-2v-7H5Zm7 2a3 3 0 110 6 3 3 0 010-6Z"/></svg>
                  )},
                  { text: 'Venue-aware routing', icon: (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 017 7c0 5.25-7 13-7 13S5 14.25 5 9a7 7 0 017-7Zm0 9.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5Z"/></svg>
                  )},
                  { text: 'Carbon neutral', icon: (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M7 20a7 7 0 110-14c.62 0 1.21.08 1.77.24A6 6 0 1120 13h-3a3 3 0 10-3 3H7Z"/></svg>
                  )},
                  { text: 'Verified partners', icon: (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M9 12l2 2 4-4 2 2-6 6-4-4 2-2Z"/></svg>
                  )}
                ].concat([
                  { text: 'Eco-friendly rides', icon: (<svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M5 11h3l3-7h4a4 4 0 014 4v7h-2a3 3 0 11-6 0H9a3 3 0 11-6 0H1v-2a2 2 0 012-2h2Z"/></svg>) },
                  { text: 'Instant booking', icon: (<svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H7a2 2 0 00-2 2v3h14V5a2 2 0 00-2-2ZM5 10v7a2 2 0 002 2h10a2 2 0 002-2v-7H5Zm7 2a3 3 0 110 6 3 3 0 010-6Z"/></svg>) },
                  { text: 'Venue-aware routing', icon: (<svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 017 7c0 5.25-7 13-7 13S5 14.25 5 9a7 7 0 017-7Zm0 9.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5Z"/></svg>) },
                  { text: 'Carbon neutral', icon: (<svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M7 20a7 7 0 110-14c.62 0 1.21.08 1.77.24A6 6 0 1120 13h-3a3 3 0 10-3 3H7Z"/></svg>) },
                  { text: 'Verified partners', icon: (<svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M9 12l2 2 4-4 2 2-6 6-4-4 2-2Z"/></svg>) }
                ]).map((item, i) => (
                  <span key={i} className="px-5 py-3 text-sm font-medium text-neutral-700 border-r border-neutral-200 inline-flex items-center gap-2">
                    {item.icon}
                    {item.text}
                  </span>
                ))}
              </div>
            </div>

            <style jsx>{`
              @keyframes marquee {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
              }
            `}</style>
          </div>
        </div>
      </section>

     {/* Partners (animated) */}
<section className="bg-neutral-50 border-b border-neutral-200 overflow-hidden">
  <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 md:py-10">
    {/* Heading */}
    <div className="text-center mb-6 sm:mb-8 fade-up">
      <h3 className="text-base sm:text-lg font-semibold text-neutral-900">Event Partners</h3>
      <p className="text-sm sm:text-base text-neutral-600">Powered by Singapore's tech community</p>
    </div>

    {/* Premium sponsor */}
    <div className="flex flex-col items-center mb-6 sm:mb-8 fade-up" style={{ animationDelay: '120ms' }}>
      <span className="mb-3 inline-flex items-center rounded-full bg-neutral-900 text-white px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-medium shadow-sm">
        Premium Sponsor
      </span>
      <a
        href="https://x.com/DeCharge__"
        target="_blank"
        rel="noopener noreferrer"
        className="relative flex flex-col items-center gap-2 sm:gap-3 bg-white border-2 border-neutral-200 hover:border-neutral-400 rounded-xl p-3 sm:p-4 transition hover:shadow-lg floaty ring-hover"
      >
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-neutral-100 flex items-center justify-center border border-neutral-200 shadow-inner">
          <img src="/icons/Decharge.jpg" alt="Decharge Logo" className="w-full h-full object-cover" />
        </div>
        <span className="text-sm sm:text-base font-semibold text-neutral-900">Decharge</span>
      </a>
    </div>

    {/* Other partners */}
    <div className="flex flex-wrap justify-center items-center gap-2 sm:gap-3">
      <a
        href="https://x.com/SuperteamSG"
        target="_blank"
        rel="noopener noreferrer"
        className="relative flex items-center gap-2 bg-white border border-neutral-200 hover:border-neutral-400 rounded-lg p-2 sm:p-3 transition hover:shadow-md hover:-translate-y-0.5 ring-hover fade-up"
        style={{ animationDelay: '220ms' }}
      >
        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full overflow-hidden bg-neutral-100 flex items-center justify-center border border-neutral-200">
          <img src="/icons/ST_singapore.jpg" alt="Superteam Singapore Logo" className="w-full h-full object-cover" />
        </div>
        <span className="text-xs sm:text-sm font-medium text-neutral-800">Superteam</span>
      </a>

      <a
        href="https://x.com/SEADePIN"
        target="_blank"
        rel="noopener noreferrer"
        className="relative flex items-center gap-2 bg-white border border-neutral-200 hover:border-neutral-400 rounded-lg p-2 sm:p-3 transition hover:shadow-md hover:-translate-y-0.5 ring-hover fade-up"
        style={{ animationDelay: '320ms' }}
      >
        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full overflow-hidden bg-neutral-100 flex items-center justify-center border border-neutral-200">
          <img src="/icons/SeaDEpin.jpg" alt="SEA DePIN Logo" className="w-full h-full object-cover" />
        </div>
        <span className="text-xs sm:text-sm font-medium text-neutral-800">SEA DePIN</span>
      </a>

      <a
        href="https://x.com/BackersStage"
        target="_blank"
        rel="noopener noreferrer"
        className="relative flex items-center gap-2 bg-white border border-neutral-200 hover:border-neutral-400 rounded-lg p-2 sm:p-3 transition hover:shadow-md hover:-translate-y-0.5 ring-hover fade-up"
        style={{ animationDelay: '420ms' }}
      >
        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full overflow-hidden bg-neutral-100 flex items-center justify-center border border-neutral-200">
          <img src="/icons/Backersstage.jpg" alt="BackerStage Logo" className="w-full h-full object-cover" />
        </div>
        <span className="text-xs sm:text-sm font-medium text-neutral-800">BackerStage</span>
      </a>
    </div>
  </div>

  {/* Scoped animations */}
  <style jsx>{`
    /* Enter reveal */
    .fade-up {
      opacity: 0;
      transform: translateY(12px);
      animation: fadeUp 700ms ease-out forwards;
    }
    @keyframes fadeUp {
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Gentle float for premium card */
    .floaty {
      animation: floatY 4.5s ease-in-out infinite;
    }
    @keyframes floatY {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-6px); }
    }

    /* Soft ring pulse on hover (uses ::after) */
    .ring-hover {
      position: relative;
      overflow: visible;
    }
    .ring-hover::after {
      content: '';
      position: absolute;
      inset: -2px;
      border-radius: 14px;
      border: 1px solid rgba(0,0,0,0.06);
      opacity: 0;
      transform: scale(0.98);
      pointer-events: none;
      transition: opacity 200ms ease, transform 200ms ease;
    }
    .ring-hover:hover::after {
      opacity: 1;
      transform: scale(1);
      animation: ringPulse 900ms ease-out;
    }
    @keyframes ringPulse {
      0%   { box-shadow: 0 0 0 0 rgba(0,0,0,0.08); }
      70%  { box-shadow: 0 0 0 8px rgba(0,0,0,0.0); }
      100% { box-shadow: 0 0 0 0 rgba(0,0,0,0.0); }
    }
  `}</style>
</section>


      {/* Scrolling Event Cards (same 4 events) — text-only, larger cards, pause on hover/focus */}
      {!isLoading && list.length > 0 && (
        <section className="border-b border-neutral-200 bg-white">
          <div className="max-w-7xl mx-auto px-4 py-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Explore Events</h3>
              
            </div>

            <div className="group relative overflow-hidden rounded-2xl border border-neutral-200">
              <div
                className="
                  flex gap-6 whitespace-nowrap py-6 px-6 will-change-transform
                  animate-[cardscroll_3s_linear_infinite]
                  group-hover:[animation-play-state:paused]
                  focus-within:[animation-play-state:paused]
                "
              >
                {[...list, ...list].map((ev, idx) => (
                  <div
                    key={`${ev._id}-${idx}`}
                    className="
                      inline-flex align-top w-[420px] md:w-[520px]
                      bg-white border border-neutral-200 rounded-2xl
                      hover:shadow-xl transition
                      focus-within:ring-2 focus-within:ring-neutral-900
                      px-5 py-5
                    "
                  >
                    <EventStripCard
                      event={ev}
                      onRide={() => handleBookRideToEvent(ev)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <style jsx>{`
              @keyframes cardscroll {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
              }
            `}</style>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="border border-neutral-200 rounded-2xl bg-white">
            <div className="max-w-4xl mx-auto px-6 py-10 text-center">
              <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                Ready to move during TOKEN2049?
              </h3>
              <p className="text-neutral-600 mt-3">
                Book your eco-friendly ride to any event and be part of the action.
              </p>
              <button
                id="cta-burst"
                onClick={() => {
                  triggerBurst('cta-burst')
                  router.push('/dashboard')
                }}
                className="relative mt-6 inline-flex items-center justify-center rounded-full bg-neutral-900 px-7 py-3 text-white text-base font-semibold shadow-sm hover:bg-black transition
                after:content-[''] after:absolute after:inset-0 after:rounded-full after:opacity-0 after:scale-50 after:pointer-events-none
                after:[background-image:radial-gradient(#ffffff_1px,transparent_1px)] after:[background-size:10px_10px] after:[mask-image:radial-gradient(circle,black,transparent_60%)]"
              >
                Start Your Journey
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-neutral-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center p-1">
                  <img src="/icons/GOLOGO.svg" alt="GoCabs Logo" className="w-full h-full" />
                </div>
                <span className="text-xl font-bold">GoCabs</span>
              </div>
              <p className="text-neutral-300 text-sm">
                Your eco-friendly ride partner for TOKEN2049 events.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
              <ul className="space-y-2 text-neutral-300 text-sm">
                <li><a href="/dashboard" className="hover:text-white transition-colors">Book a Ride</a></li>
                <li><a href="/driver" className="hover:text-white transition-colors">Become a Driver</a></li>
                <li><span className="cursor-default">About Us</span></li>
                <li><span className="cursor-default">Contact</span></li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Connect</h3>
              <div className="flex gap-4">
                <a
                  href="https://x.com/gocabs_xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neutral-300 hover:text-white transition-colors"
                  aria-label="Follow GoCabs on X"
                >
                  {/* X icon */}
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
                    <path d="M18.244 2H21l-6.56 7.49L22.5 22h-6.93l-4.52-5.95L5.9 22H3.14l7.02-8.02L1.5 2h7.03l4.07 5.47L18.24 2Zm-1.216 18h1.89L8.05 4h-1.9l10.878 16Z"/>
                  </svg>
                </a>
              </div>
              <p className="text-neutral-400 text-sm mt-4">
                © 2024 GoCabs. Sustainable mobility for tech events.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

/** TEXT-ONLY STRIP CARD (no images), with Ride + Follow buttons always visible */
function EventStripCard({
  event,
  onRide
}: {
  event: Event
  onRide: () => void
}) {
  const { d, h, m, sec, isOver } = useCountdown(event.startDate)
  const status = event.isPast ? 'Ended'
    : event.isHappeningNow ? 'Live'
    : event.isUpcoming ? 'Upcoming' : ''

  const statusStyle =
    status === 'Live'
      ? 'bg-red-100 text-red-700'
      : status === 'Upcoming'
        ? 'bg-emerald-100 text-emerald-700'
        : status === 'Ended'
          ? 'bg-neutral-100 text-neutral-600'
          : 'bg-neutral-100 text-neutral-700'

  return (
    <article tabIndex={0} className="w-full outline-none" aria-label={event.title}>
      {/* Header row: title + status */}
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-lg font-bold leading-tight line-clamp-2">{event.title}</h4>
        {status && (
          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusStyle}`}>
            {status}
          </span>
        )}
      </div>

      {/* Meta */}
      <div className="mt-2 space-y-1 text-sm text-neutral-700">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-neutral-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 4l6 6m0-6l-6 6" />
          </svg>
          <span className="tabular-nums">{prettyDate(event.startDate)}</span>
        </div>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-neutral-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="truncate">{event.venue.name}</span>
        </div>
      </div>

      {/* Summary */}
      <p className="mt-3 text-sm text-neutral-700 line-clamp-3">
        {event.shortDescription}
      </p>

      {/* Countdown if upcoming */}
      {event.isUpcoming && !isOver && (
        <div className="mt-3 text-xs">
          <span className="px-2 py-1 rounded border border-neutral-200 text-neutral-800">
            Starts in <span className="font-semibold tabular-nums">{d}d {h}h {m}m {sec}s</span>
          </span>
        </div>
      )}

      {/* Actions: Ride + Follow (always visible) */}
      <div className="mt-5 flex items-center gap-2">
        <button
          onClick={onRide}
          disabled={event.isPast}
          className={`inline-flex justify-center items-center px-4 py-2 rounded-full text-sm font-semibold transition shadow-sm
            ${event.isPast ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed' : 'bg-neutral-900 hover:bg-black text-white'}
          `}
        >
          Ride
        </button>

        <button
          onClick={() => {
            const handle = getEventPartnerHandle(event.eventId)
            if (handle) window.open(`https://x.com/${handle}`, '_blank')
          }}
          className="inline-flex justify-center items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border border-neutral-300 hover:bg-neutral-50"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
            <path d="M18.244 2H21l-6.56 7.49L22.5 22h-6.93l-4.52-5.95L5.9 22H3.14l7.02-8.02L1.5 2h7.03l4.07 5.47L18.24 2Zm-1.216 18h1.89L8.05 4h-1.9l10.878 16Z"/>
          </svg>
          Follow
        </button>
      </div>
    </article>
  )
}
