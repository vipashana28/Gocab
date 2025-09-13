/**
 * Google Maps Singleton Loader
 * Ensures Google Maps API is loaded only once across the entire application
 */

import { Loader } from '@googlemaps/js-api-loader'

// Global promise to track loading state
let mapsPromise: Promise<typeof google> | null = null
let isLoading = false
let isLoaded = false

/**
 * Load Google Maps API with singleton pattern
 * Returns the same promise for concurrent calls
 */
export function loadGoogleMaps(apiKey?: string): Promise<typeof google> {
  // Return existing promise if already loading or loaded
  if (mapsPromise) {
    return mapsPromise
  }

  // Check if Google Maps is already available
  if (typeof window !== 'undefined' && window.google?.maps) {
    isLoaded = true
    mapsPromise = Promise.resolve(window.google)
    return mapsPromise
  }

  // Get API key from environment if not provided
  const key = apiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  if (!key) {
    const error = new Error('Google Maps API key not found. Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your environment variables.')
    mapsPromise = Promise.reject(error)
    return mapsPromise
  }

  // Create new loading promise
  isLoading = true
  
  mapsPromise = new Promise<typeof google>(async (resolve, reject) => {
    try {
      console.log('🗺️ Loading Google Maps API (singleton)...')
      
      // Try using the Loader first
      try {
        const loader = new Loader({
          apiKey: key,
          version: 'weekly',
          libraries: ['places', 'geometry', 'marker']
        })

        await loader.load()
        console.log('✅ Google Maps API loaded successfully via Loader')
        
        if (window.google?.maps) {
          isLoaded = true
          isLoading = false
          resolve(window.google)
        } else {
          throw new Error('Google Maps API loaded but not available on window')
        }
      } catch (loaderError) {
        console.warn('⚠️ Loader failed, trying direct script injection:', loaderError)
        
        // Fallback to direct script injection
        await loadViaScript(key)
        
        if (window.google?.maps) {
          console.log('✅ Google Maps API loaded successfully via script injection')
          isLoaded = true
          isLoading = false
          resolve(window.google)
        } else {
          throw new Error('Google Maps API script loaded but not available')
        }
      }
    } catch (error) {
      console.error('❌ Failed to load Google Maps API:', error)
      isLoading = false
      mapsPromise = null // Reset so it can be retried
      reject(error)
    }
  })

  return mapsPromise
}

/**
 * Load Google Maps via direct script injection (fallback method)
 */
function loadViaScript(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if script already exists
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
    if (existingScript) {
      // Script exists, wait for it to load
      if (window.google?.maps) {
        resolve()
      } else {
        existingScript.addEventListener('load', () => resolve())
        existingScript.addEventListener('error', () => reject(new Error('Existing Google Maps script failed to load')))
      }
      return
    }

    // Create new script element
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry,marker&v=weekly`
    script.async = true
    script.defer = true
    
    script.onload = () => {
      console.log('📜 Google Maps script loaded directly')
      resolve()
    }
    
    script.onerror = () => {
      reject(new Error('Failed to load Google Maps script'))
    }
    
    document.head.appendChild(script)
  })
}

/**
 * Check if Google Maps API is currently loading
 */
export function isGoogleMapsLoading(): boolean {
  return isLoading
}

/**
 * Check if Google Maps API is loaded and ready
 */
export function isGoogleMapsLoaded(): boolean {
  return isLoaded && typeof window !== 'undefined' && !!window.google?.maps
}

/**
 * Get Google Maps API if already loaded, null otherwise
 */
export function getGoogleMaps(): typeof google | null {
  if (typeof window !== 'undefined' && window.google?.maps) {
    return window.google
  }
  return null
}

/**
 * Reset the loader state (for testing or error recovery)
 */
export function resetGoogleMapsLoader(): void {
  mapsPromise = null
  isLoading = false
  isLoaded = false
  console.log('🔄 Google Maps loader state reset')
}
