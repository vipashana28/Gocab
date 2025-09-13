'use client'

import { useState, useEffect, useMemo } from 'react'

interface FareEstimate {
  baseFare: number
  distanceFare: number
  timeFare: number
  surgeFare: number
  totalFare: number
  currency: string
  breakdown: {
    baseRate: number
    perKmRate: number
    perMinuteRate: number
    surgeMultiplier: number
    distance: number
    duration: number
  }
}

interface RouteData {
  distance: { text: string; value: number; km: number }
  duration: { text: string; value: number; minutes: number }
  durationInTraffic: { text: string; value: number; minutes: number }
  startAddress: string
  endAddress: string
  polyline: string
  fareEstimate: FareEstimate
}

interface FareEstimationProps {
  pickup?: { address: string; coordinates?: { latitude: number; longitude: number } | null }
  destination?: { address: string; coordinates?: { latitude: number; longitude: number } | null }
  onRouteCalculated?: (routeData: RouteData) => void
  className?: string
}

export default function FareEstimation({
  pickup,
  destination,
  onRouteCalculated,
  className = ''
}: FareEstimationProps) {
  const [routeData, setRouteData] = useState<RouteData | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isMounted, setIsMounted] = useState(true)

  // Stable input key
  const requestKey = useMemo(() => {
    if (!pickup?.address || !destination?.address) return null
    const valid = (c?: { latitude: number; longitude: number } | null) =>
      !!c && Number.isFinite(c.latitude) && Number.isFinite(c.longitude)
    const pk = valid(pickup.coordinates)
      ? `${pickup!.coordinates!.latitude},${pickup!.coordinates!.longitude}`
      : pickup.address
    const dk = valid(destination.coordinates)
      ? `${destination!.coordinates!.latitude},${destination!.coordinates!.longitude}`
      : destination.address
    return `${pk}|${dk}`
  }, [
    pickup?.address,
    pickup?.coordinates?.latitude,
    pickup?.coordinates?.longitude,
    destination?.address,
    destination?.coordinates?.latitude,
    destination?.coordinates?.longitude
  ])

  // Fetch route on change (no functionality change)
  useEffect(() => {
    if (!pickup || !destination || !requestKey) {
      setRouteData(null)
      setError(null)
      return
    }
    if (
      pickup.address.length < 10 ||
      destination.address.length < 10
    ) {
      setRouteData(null)
      setError(null)
      return
    }

    const t = setTimeout(async () => {
      if (!isMounted) return
      setIsCalculating(true)
      setError(null)

      try {
        let pickupCoords = pickup.coordinates
        let destinationCoords = destination.coordinates

        if (!pickupCoords) {
          const r = await fetch(`/api/geocoding?address=${encodeURIComponent(pickup.address)}`)
          const g = await r.json()
          if (g.success && g.data.length > 0) pickupCoords = g.data[0].coordinates
        }
        if (!destinationCoords) {
          const r = await fetch(`/api/geocoding?address=${encodeURIComponent(destination.address)}`)
          const g = await r.json()
          if (g.success && g.data.length > 0) destinationCoords = g.data[0].coordinates
        }
        if (!pickupCoords || !destinationCoords) {
          if (isMounted) {
            setError('Unable to determine locations from addresses')
            setIsCalculating(false)
          }
          return
        }

        const response = await fetch('/api/directions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origin: { latitude: pickupCoords.latitude, longitude: pickupCoords.longitude },
            destination: { latitude: destinationCoords.latitude, longitude: destinationCoords.longitude },
            travelMode: 'DRIVING',
            avoidHighways: false,
            avoidTolls: false
          })
        })
        const result = await response.json()
        if (!result.success) throw new Error(result.error || 'Failed to calculate route')

        if (isMounted) {
          setRouteData(result.data)
          onRouteCalculated?.(result.data)
        }
      } catch (e) {
        if (isMounted) {
          console.error('Route calculation error:', e)
          setError(e instanceof Error ? e.message : 'Failed to calculate route')
          setRouteData(null)
        }
      } finally {
        if (isMounted) setIsCalculating(false)
      }
    }, 650)

    return () => clearTimeout(t)
  }, [requestKey])

  useEffect(() => () => setIsMounted(false), [])

  // ---------- UI ----------

  if (!pickup || !destination) {
    return (
      <div className={`rounded-3xl border border-neutral-200 bg-white p-6 ${className}`}>
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-neutral-300">
            <svg className="h-6 w-6 text-neutral-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2a7 7 0 017 7c0 5.25-7 13-7 13S5 14.25 5 9a7 7 0 017-7Zm0 9.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5Z" />
            </svg>
          </div>
          <p className="text-base text-neutral-600">Select pickup and destination to preview your trip.</p>
        </div>
      </div>
    )
  }

  if (isCalculating) {
    return (
      <div className={`relative overflow-hidden rounded-3xl border border-neutral-200 bg-white p-6 ${className}`}>
        <div className="flex items-center gap-3">
          <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent" />
          <span className="text-lg text-neutral-800">Finding the best route…</span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="h-16 rounded-xl bg-neutral-100 animate-pulse" />
          <div className="h-16 rounded-xl bg-neutral-100 animate-pulse" />
        </div>
        <div className="mt-3 h-20 rounded-xl bg-neutral-100 animate-pulse" />
      </div>
    )
  }

  if (error) {
    return (
      <div className={`rounded-3xl border border-red-200 bg-red-50 p-6 ${className}`}>
        <div className="flex items-center gap-2 text-red-700">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86l-8.48 14.7A2 2 0 003.52 21h16.96a2 2 0 001.71-3.44l-8.48-14.7a2 2 0 00-3.42 0z"/>
          </svg>
          <span className="font-medium text-lg">Unable to calculate route</span>
        </div>
        <p className="mt-1 text-base text-red-700/90">{error}</p>
      </div>
    )
  }

  if (!routeData) return null

  const { distance, durationInTraffic } = routeData
  const km = (routeData.fareEstimate?.breakdown?.distance ?? distance.km) || 0

  // Impact metrics (unchanged math)
  const co2SavedKg = km * 0.21
  const trees = Math.max(1, Math.round(co2SavedKg * 2.47))
  const fuelL = (km * 0.08).toFixed(1)

  // For lively progress meters (purely visual; no functionality change)
  const clampPct = (val: number, max: number) => `${Math.min(100, Math.max(5, Math.round((val / max) * 100)))}%`

  return (
    <div
      className={`
        group relative overflow-hidden rounded-3xl border border-neutral-200 bg-white
        shadow-[0_10px_40px_rgba(0,0,0,0.06)] transition
        hover:shadow-[0_16px_60px_rgba(16,185,129,0.18)]
        ${className}
      `}
    >
      {/* very subtle dynamic green shine on hover (no gradient fill on elements) */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="absolute -inset-8 rounded-[40px] [box-shadow:0_0_0_1px_rgba(16,185,129,0.10)_inset,0_0_120px_30px_rgba(16,185,129,0.08)]" />
      </div>

      {/* Header */}
      <header className="flex items-start justify-between gap-4 border-b border-neutral-200 p-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-200 bg-white">
              {/* animated route icon */}
              <svg className="h-6 w-6 text-neutral-900" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M8 7V4a2 2 0 012-2h4a2 2 0 012 2v3m-9 5a4 4 0 108 0 4 4 0 10-8 0z" />
              </svg>
            </div>
            {/* tiny pulsing locator dot */}
            <span className="absolute -right-1 -top-1 inline-block h-3 w-3 animate-ping rounded-full bg-emerald-500/70" />
          </div>
          <div className="leading-tight">
            <h3 className="text-xl font-bold tracking-tight text-neutral-900">Trip Overview</h3>
            <p className="text-sm text-neutral-500">
              {truncate(routeData.startAddress, 40)} → {truncate(routeData.endAddress, 40)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <span className="inline-flex h-3 w-3 rounded-full bg-emerald-500" />
          Live
        </div>
      </header>

      {/* Key metrics (with light motion) */}
      <section className="grid grid-cols-2 gap-4 p-6">
        <Tile
          label="Distance"
          value={distance.text}
          icon={
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2a7 7 0 017 7c0 5.25-7 13-7 13S5 14.25 5 9a7 7 0 017-7Zm0 9.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5Z" />
            </svg>
          }
        />
        <Tile
          label="Duration (traffic)"
          value={durationInTraffic.text}
          icon={
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </section>

      {/* Environmental Impact — lively & readable */}
      <section className="px-6 pb-6">
        <h4 className="mb-4 text-lg font-semibold text-neutral-900">Environmental Impact</h4>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* CO2 */}
          <ImpactMeter
            label="CO₂ saved"
            valueDisplay={`${co2SavedKg.toFixed(1)} kg`}
            percent={clampPct(co2SavedKg, 30)} // visual scale only
            icon={
              <svg className="h-5 w-5 text-neutral-900" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 20a7 7 0 110-14c.62 0 1.21.08 1.77.24A6 6 0 1120 13h-3a3 3 0 10-3 3H7Z" />
              </svg>
            }
          />
          {/* Trees */}
          <ImpactMeter
            label="Trees equivalent"
            valueDisplay={`${trees}`}
            percent={clampPct(trees, 60)} // visual scale only
            icon={
              <svg className="h-5 w-5 text-neutral-900" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            }
          />
          {/* Fuel */}
          <ImpactMeter
            label="Fuel saved"
            valueDisplay={`${fuelL} L`}
            percent={clampPct(parseFloat(fuelL), 5)} // visual scale only
            icon={
              <svg className="h-5 w-5 text-neutral-900" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            }
          />
        </div>

        <p className="mt-4 text-center text-xs text-neutral-500">
          Figures are indicative compared with typical private vehicle usage.
        </p>
      </section>
    </div>
  )
}

/* ---------- Small building blocks ---------- */

function truncate(s: string, n: number) {
  return s?.length > n ? s.slice(0, n - 1) + '…' : s
}

function Tile({
  label,
  value,
  icon
}: {
  label: string
  value: string | number
  icon: React.ReactNode
}) {
  return (
    <div
      className="
        rounded-2xl border border-neutral-200 bg-white p-4
        transition will-change-transform
        hover:-translate-y-[2px] hover:shadow-[0_8px_30px_rgba(16,185,129,0.12)]
      "
    >
        <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200">
            {icon}
          </span>
          <span>{label}</span>
        </div>
        {/* animated tick mark to feel "alive" */}
        <span className="relative inline-block h-3 w-3">
          <span className="absolute inset-0 animate-pulse rounded-full bg-emerald-500/70" />
        </span>
      </div>
      <div className="mt-2 text-3xl font-extrabold tabular-nums text-neutral-900">{value}</div>
    </div>
  )
}

function ImpactMeter({
  label,
  valueDisplay,
  percent,
  icon
}: {
  label: string
  valueDisplay: string
  percent: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200">
            {icon}
          </span>
          <span>{label}</span>
        </div>
        <div className="text-lg font-bold text-neutral-900 tabular-nums">{valueDisplay}</div>
      </div>

      {/* lively bar with shimmer & green cap — no gradients */}
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-neutral-100">
        {/* track shimmer */}
        <div className="absolute inset-0 animate-shimmer bg-[linear-gradient(90deg,rgba(0,0,0,0)_0,rgba(0,0,0,0.05)_40%,rgba(0,0,0,0)_80%)] bg-[length:200%_100%]" />
        {/* fill */}
        <div
          className="relative h-full rounded-full bg-emerald-500 transition-[width] duration-700 ease-out"
          style={{ width: percent }}
        >
          {/* bright cap */}
          <span className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-white shadow-[0_0_0_2px_#10B981,0_0_12px_2px_rgba(16,185,129,.35)]" />
        </div>
      </div>
    </div>
  )
}

/* ---------- Local CSS animations (no gradients on components, only effects) ---------- */
<style jsx>{`
  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`}</style>
