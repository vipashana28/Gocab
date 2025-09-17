'use client'

import { useState, useEffect, useMemo } from 'react'
import { 
  MapPin, 
  AlertTriangle, 
  Route, 
  Clock, 
  Cloud, 
  Sparkles, 
  Fuel 
} from 'lucide-react'

interface FareEstimate {
  baseFare: number
  distanceFare: number
  timeFare: number
  surgeFare: number
  platformFee: number
  totalFare: number
  currency: string
  breakdown: {
    baseRate: number
    perKmRate: number
    perMinuteRate: number
    surgeMultiplier: number
    platformFeePercentage: number
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
            <MapPin className="h-6 w-6 text-neutral-600" />
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
          <AlertTriangle className="h-6 w-6" />
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
              <Route className="h-6 w-6 text-neutral-900" />
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
          icon={<MapPin className="h-5 w-5" />}
        />
        <Tile
          label="Duration (traffic)"
          value={durationInTraffic.text}
          icon={<Clock className="h-5 w-5" />}
        />
      </section>

      {/* Fare Breakdown - SGD */}
      {routeData.fareEstimate && (
        <section className="px-6 pb-4 border-b border-neutral-200">
          <h4 className="mb-4 text-lg font-semibold text-neutral-900">Trip Fare</h4>
          
          {/* Total Fare - Prominent */}
          <div className="mb-4 text-center">
            <div className="text-3xl font-bold text-green-600 mb-1">
              ${routeData.fareEstimate.totalFare.toFixed(2)}
            </div>
            <p className="text-sm text-neutral-500">Total estimated fare</p>
          </div>
          
          {/* Fare Breakdown */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-600">Base fare</span>
              <span className="font-medium">${routeData.fareEstimate.baseFare.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-600">Distance ({routeData.fareEstimate.breakdown.distance} km @ ${routeData.fareEstimate.breakdown.perKmRate}/km)</span>
              <span className="font-medium">${routeData.fareEstimate.distanceFare.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-600">Time ({routeData.fareEstimate.breakdown.duration.toFixed(1)} min @ ${routeData.fareEstimate.breakdown.perMinuteRate}/min)</span>
              <span className="font-medium">${routeData.fareEstimate.timeFare.toFixed(2)}</span>
            </div>
            {routeData.fareEstimate.surgeFare > 0 && (
              <div className="flex justify-between">
                <span className="text-neutral-600">Surge ({((routeData.fareEstimate.breakdown.surgeMultiplier - 1) * 100).toFixed(0)}%)</span>
                <span className="font-medium text-orange-600">${routeData.fareEstimate.surgeFare.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-neutral-600">Platform fee ({(routeData.fareEstimate.breakdown.platformFeePercentage * 100).toFixed(0)}%)</span>
              <span className="font-medium">${routeData.fareEstimate.platformFee.toFixed(2)}</span>
            </div>
            <div className="border-t border-neutral-200 pt-2 flex justify-between font-semibold">
              <span>Total</span>
              <span className="text-green-600">${routeData.fareEstimate.totalFare.toFixed(2)}</span>
            </div>
          </div>
          
          <p className="mt-3 text-xs text-neutral-500 text-center">
            * Final fare may vary based on actual route and traffic conditions
          </p>
        </section>
      )}

      {/* Environmental Impact — lively & readable */}
      <section className="px-6 pb-6">
        <h4 className="mb-4 text-lg font-semibold text-neutral-900">Environmental Impact</h4>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* CO2 */}
          <ImpactMeter
            label="CO₂ saved"
            valueDisplay={`${co2SavedKg.toFixed(1)} kg`}
            percent={clampPct(co2SavedKg, 30)} // visual scale only
            icon={<Cloud className="h-5 w-5 text-neutral-900" />}
          />
          {/* Trees */}
          <ImpactMeter
            label="Trees equivalent"
            valueDisplay={`${trees}`}
            percent={clampPct(trees, 60)} // visual scale only
            icon={<Sparkles className="h-5 w-5 text-neutral-900" />}
          />
          {/* Fuel */}
          <ImpactMeter
            label="Fuel saved"
            valueDisplay={`${fuelL} L`}
            percent={clampPct(parseFloat(fuelL), 5)} // visual scale only
            icon={<Fuel className="h-5 w-5 text-neutral-900" />}
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
