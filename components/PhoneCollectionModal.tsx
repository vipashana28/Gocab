'use client'

import { useState } from 'react'

export interface DriverDetails {
  phoneNumber: string
  vehicleName: string
  licensePlate: string
  vehicleType: '4-wheeler' | '6-wheeler'
}

interface PhoneCollectionModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (driverDetails: DriverDetails) => void
  isLoading?: boolean
}

export default function PhoneCollectionModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  isLoading = false 
}: PhoneCollectionModalProps) {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [vehicleName, setVehicleName] = useState('')
  const [licensePlate, setLicensePlate] = useState('')
  const [vehicleType, setVehicleType] = useState<'4-wheeler' | '6-wheeler'>('4-wheeler')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validatePhoneNumber = (phone: string): boolean => {
    // Basic phone validation - accepts various formats
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '')
    return phoneRegex.test(cleanPhone) && cleanPhone.length >= 8
  }

  const validateVehicleName = (name: string): boolean => {
    return name.trim().length >= 2 && name.trim().length <= 50
  }

  const validateLicensePlate = (plate: string): boolean => {
    // Accept various license plate formats (alphanumeric, 6-10 characters)
    const plateRegex = /^[A-Z0-9\s\-]{6,10}$/i
    return plateRegex.test(plate.trim())
  }

  const validateAllFields = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    const formattedPhone = formatPhoneNumber(phoneNumber)
    if (!validatePhoneNumber(formattedPhone)) {
      newErrors.phoneNumber = 'Please enter a valid phone number (e.g., +1234567890)'
    }
    
    if (!validateVehicleName(vehicleName)) {
      newErrors.vehicleName = 'Vehicle name must be 2-50 characters long'
    }
    
    if (!validateLicensePlate(licensePlate)) {
      newErrors.licensePlate = 'Please enter a valid license plate (6-10 characters, letters and numbers)'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const formatPhoneNumber = (phone: string): string => {
    // Remove all non-digit characters except +
    const cleaned = phone.replace(/[^\d\+]/g, '')
    
    // If it starts with +, keep it, otherwise add + if it doesn't start with it
    if (cleaned.startsWith('+')) {
      return cleaned
    } else if (cleaned.length > 0) {
      return '+' + cleaned
    }
    return cleaned
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateAllFields()) {
      return
    }

    const driverDetails: DriverDetails = {
      phoneNumber: formatPhoneNumber(phoneNumber),
      vehicleName: vehicleName.trim(),
      licensePlate: licensePlate.trim().toUpperCase(),
      vehicleType
    }

    onSubmit(driverDetails)
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setPhoneNumber(value)
    if (errors.phoneNumber) {
      setErrors(prev => ({ ...prev, phoneNumber: '' }))
    }
  }

  const handleVehicleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setVehicleName(value)
    if (errors.vehicleName) {
      setErrors(prev => ({ ...prev, vehicleName: '' }))
    }
  }

  const handleLicensePlateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase()
    setLicensePlate(value)
    if (errors.licensePlate) {
      setErrors(prev => ({ ...prev, licensePlate: '' }))
    }
  }

  const handleVehicleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setVehicleType(e.target.value as '4-wheeler' | '6-wheeler')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12a3 3 0 11-6 0 3 3 0 016 0zm8-5a3 3 0 110 6 3 3 0 010-6zM3 20a6 6 0 0112 0v1H3v-1zm6 0a6 6 0 0112 0v1h-9V20z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold">Driver Registration</h2>
              <p className="text-green-100 text-sm">Complete your profile to start driving with GoCabs</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <p className="text-gray-600 mb-6">
              Please provide your contact information and vehicle details to complete your driver registration.
            </p>
            
            {/* Phone Number */}
            <div className="space-y-2 mb-4">
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                Phone Number *
              </label>
              <input
                type="tel"
                id="phone"
                value={phoneNumber}
                onChange={handlePhoneChange}
                placeholder="+1234567890"
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors ${
                  errors.phoneNumber ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                disabled={isLoading}
                autoFocus
              />
              {errors.phoneNumber && (
                <p className="text-red-600 text-sm flex items-center space-x-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{errors.phoneNumber}</span>
                </p>
              )}
            </div>

            {/* Vehicle Name/Model */}
            <div className="space-y-2 mb-4">
              <label htmlFor="vehicleName" className="block text-sm font-medium text-gray-700">
                Car Name & Model *
              </label>
              <input
                type="text"
                id="vehicleName"
                value={vehicleName}
                onChange={handleVehicleNameChange}
                placeholder="e.g., Toyota Camry, Honda Civic"
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors ${
                  errors.vehicleName ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                disabled={isLoading}
              />
              {errors.vehicleName && (
                <p className="text-red-600 text-sm flex items-center space-x-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{errors.vehicleName}</span>
                </p>
              )}
            </div>

            {/* License Plate */}
            <div className="space-y-2 mb-4">
              <label htmlFor="licensePlate" className="block text-sm font-medium text-gray-700">
                License Plate Number *
              </label>
              <input
                type="text"
                id="licensePlate"
                value={licensePlate}
                onChange={handleLicensePlateChange}
                placeholder="e.g., ABC123, XYZ789"
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors ${
                  errors.licensePlate ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                disabled={isLoading}
                style={{ textTransform: 'uppercase' }}
              />
              {errors.licensePlate && (
                <p className="text-red-600 text-sm flex items-center space-x-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{errors.licensePlate}</span>
                </p>
              )}
            </div>

            {/* Vehicle Type */}
            <div className="space-y-2 mb-4">
              <label htmlFor="vehicleType" className="block text-sm font-medium text-gray-700">
                Vehicle Type *
              </label>
              <select
                id="vehicleType"
                value={vehicleType}
                onChange={handleVehicleTypeChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors bg-white"
                disabled={isLoading}
              >
                <option value="4-wheeler">4-Wheeler (Car/SUV)</option>
                <option value="6-wheeler">6-Wheeler (Van/Truck)</option>
              </select>
            </div>
          </div>

          {/* Privacy Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-blue-800 text-sm font-medium">Privacy & Security</p>
                <p className="text-blue-700 text-xs mt-1">
                  Your information will only be shared with riders during active rides for safety and coordination. Vehicle details help riders identify your car easily.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-3">
            <button
              type="submit"
              disabled={isLoading || !phoneNumber.trim() || !vehicleName.trim() || !licensePlate.trim()}
              className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all flex items-center justify-center space-x-2 ${
                isLoading || !phoneNumber.trim() || !vehicleName.trim() || !licensePlate.trim()
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Continue</span>
                </>
              )}
            </button>
          </div>

          {/* Note about mandatory requirement */}
          <p className="text-xs text-gray-500 text-center">
            All fields are required to access driver features. This information helps ensure rider safety and easy vehicle identification.
          </p>
        </form>
      </div>
    </div>
  )
}
