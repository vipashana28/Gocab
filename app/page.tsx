'use client'

import { useEffect } from 'react'
import { useGoCabAuth } from '@/lib/auth/use-gocab-auth'

export default function HomePage() {
  const { 
    isAuthenticated, 
    user, 
    isLoading, 
    error,
    signIn, 
    signOut, 
    updateLastActive,
    clearError 
  } = useGoCabAuth()

  // Update user activity when page loads
  useEffect(() => {
    if (isAuthenticated && user) {
      updateLastActive()
    }
  }, [isAuthenticated, user, updateLastActive])

  // Clear any errors after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearError()
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [error, clearError])

  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-4">
            Go<span className="text-primary-600">Cab</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Your eco-friendly ride is just a tap away. Track your carbon savings while getting around the city.
          </p>
          
          {/* Error Display */}
          {error && (
            <div className="mt-4 inline-flex items-center bg-red-100 text-red-800 px-4 py-2 rounded-full">
              <span className="mr-2">⚠</span>
              {error}
            </div>
          )}

          {/* Auth Status */}
          {isAuthenticated && user && (
            <div className="mt-4 inline-flex items-center bg-green-100 text-green-800 px-4 py-2 rounded-full">
              <span className="mr-2">✓</span>
              Welcome, {user.firstName || user.email}!
              {user.isSponsored && (
                <span className="ml-2 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                  Sponsored
                </span>
              )}
              <button 
                onClick={signOut}
                className="ml-3 text-green-600 hover:text-green-700 underline"
                disabled={isLoading}
              >
                Sign Out
              </button>
            </div>
          )}
        </header>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          {/* Quick Actions Card */}
          <div className="card mb-8">
            <h2 className="text-2xl font-semibold mb-6 text-center">
              {isAuthenticated ? 'What would you like to do?' : 'Ready to ride?'}
            </h2>
            
            {!isAuthenticated ? (
              // Show sign-in options when not authenticated
              <div className="space-y-4">
                <div className="flex justify-center">
                  <button 
                    className="btn-primary text-lg py-4 px-8 w-full max-w-md"
                    disabled={isLoading}
                    onClick={() => {
                      console.log('Sign In with Civic button clicked!')
                      signIn()
                    }}
                  >
                    {isLoading ? 'Connecting to Civic...' : 'Sign In with Civic'}
                  </button>
                </div>
                <p className="text-center text-sm text-gray-500">
                  Click above to access the GoCab dashboard
                </p>
              </div>
            ) : (
              // Show full options when authenticated
              <>
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <button 
                    onClick={() => window.location.href = '/dashboard'}
                    className="btn-primary text-lg py-4 px-8 w-full"
                    disabled={isLoading}
                  >
                    Go to Dashboard
                  </button>
                  <button 
                    onClick={() => window.location.href = '/events'}
                    className="btn-secondary text-lg py-4 px-8 w-full"
                    disabled={isLoading}
                  >
                    View Events
                  </button>
                </div>
                
                {/* User Stats */}
                {user && (
                  <div className="grid md:grid-cols-3 gap-4 text-center">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{user.totalRides}</div>
                      <div className="text-sm text-blue-800">Total Rides</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {user.totalCarbonSaved.toFixed(1)}kg
                      </div>
                      <div className="text-sm text-green-800">CO₂ Saved</div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {new Date(user.memberSince).toLocaleDateString()}
                      </div>
                      <div className="text-sm text-purple-800">Member Since</div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="card text-center">
              <div className="text-4xl mb-4">🚗</div>
              <h3 className="text-xl font-semibold mb-2">Easy Booking</h3>
              <p className="text-gray-600">Book your ride in seconds with our simple interface</p>
            </div>
            <div className="card text-center">
              <div className="text-4xl mb-4">🌱</div>
              <h3 className="text-xl font-semibold mb-2">Eco-Friendly</h3>
              <p className="text-gray-600">Track your carbon footprint savings with every ride</p>
            </div>
            <div className="card text-center">
              <div className="text-4xl mb-4">📱</div>
              <h3 className="text-xl font-semibold mb-2">Real-Time Tracking</h3>
              <p className="text-gray-600">See your driver's location and route in real-time</p>
            </div>
          </div>

          {/* Status Section */}
          <div className="card text-center">
            <h3 className="text-lg font-medium text-gray-800 mb-2">Pilot Program</h3>
            <p className="text-gray-600">
              Currently serving a limited number of pre-approved drivers and sponsored riders.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
