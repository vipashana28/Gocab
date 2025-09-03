// Geocoding utility functions

export interface GeocodedLocation {
  address: string
  coordinates: {
    latitude: number
    longitude: number
  }
  details?: {
    house_number?: string
    road?: string
    city?: string
    state?: string
    postcode?: string
    country?: string
    type?: string
    importance?: number
  }
  boundingBox?: {
    north: number
    south: number
    east: number
    west: number
  }
}

export interface GeocodeResponse {
  success: boolean
  data: GeocodedLocation[]
  error?: string
  meta?: {
    query: string
    resultsCount: number
    provider: string
  }
}

export interface ReverseGeocodeResponse {
  success: boolean
  data: GeocodedLocation | null
  error?: string
  meta?: {
    query: { latitude: number; longitude: number }
    provider: string
  }
}

/**
 * Geocode an address to get coordinates
 */
export async function geocodeAddress(address: string): Promise<GeocodeResponse> {
  try {
    const response = await fetch(`/api/geocoding?address=${encodeURIComponent(address)}`)
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Geocoding error:', error)
    return {
      success: false,
      data: [],
      error: 'Failed to geocode address'
    }
  }
}

/**
 * Reverse geocode coordinates to get an address
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResponse> {
  try {
    const response = await fetch('/api/geocoding', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ latitude, longitude })
    })
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Reverse geocoding error:', error)
    return {
      success: false,
      data: null,
      error: 'Failed to reverse geocode coordinates'
    }
  }
}

/**
 * Get the best/most relevant result from geocoding results
 */
export function getBestGeocodeResult(results: GeocodedLocation[]): GeocodedLocation | null {
  if (results.length === 0) return null
  
  // Sort by importance (higher is better) and return the first result
  const sorted = results.sort((a, b) => {
    const importanceA = a.details?.importance || 0
    const importanceB = b.details?.importance || 0
    return importanceB - importanceA
  })
  
  return sorted[0]
}

/**
 * Validate if an address string looks reasonable for geocoding
 */
export function validateAddressInput(address: string): { isValid: boolean; error?: string } {
  if (!address || typeof address !== 'string') {
    return { isValid: false, error: 'Address is required' }
  }
  
  const trimmed = address.trim()
  
  if (trimmed.length < 3) {
    return { isValid: false, error: 'Address too short (minimum 3 characters)' }
  }
  
  if (trimmed.length > 200) {
    return { isValid: false, error: 'Address too long (maximum 200 characters)' }
  }
  
  // Basic check for some address-like content
  if (!/[a-zA-Z0-9]/.test(trimmed)) {
    return { isValid: false, error: 'Address must contain letters or numbers' }
  }
  
  return { isValid: true }
}

/**
 * Format a geocoded location for display
 */
export function formatLocationForDisplay(location: GeocodedLocation): string {
  const details = location.details
  if (!details) return location.address
  
  // Try to create a shorter, more readable format
  const parts = []
  
  if (details.house_number && details.road) {
    parts.push(`${details.house_number} ${details.road}`)
  } else if (details.road) {
    parts.push(details.road)
  }
  
  if (details.city) {
    parts.push(details.city)
  }
  
  if (details.state) {
    parts.push(details.state)
  }
  
  return parts.length > 0 ? parts.join(', ') : location.address
}
