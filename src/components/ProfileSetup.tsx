import React, { useState } from 'react'
import { User, Camera, AlertCircle, CheckCircle, HardHat } from 'lucide-react'
import { getServiceTypeLabel, getServiceTypeDescription } from '../utils/serviceTypes'
import { getErrorMessage } from '../utils/errors'

interface ProfileSetupProps {
  onComplete: (profileData: {
    name: string
    service_type: 'publisher' | 'auxiliary_pioneer' | 'regular_pioneer'
    avatar_url?: string
    is_volunteer: boolean
  }) => Promise<void>
  onUploadAvatar: (file: File) => Promise<{ data: string | null; error: Error | null }>
  loading?: boolean
}

const ProfileSetup: React.FC<ProfileSetupProps> = ({ onComplete, onUploadAvatar, loading = false }) => {
  const [name, setName] = useState('')
  const [serviceType, setServiceType] = useState<'publisher' | 'auxiliary_pioneer' | 'regular_pioneer'>('publisher')
  const [isVolunteer, setIsVolunteer] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [error, setError] = useState('')
  const [imageError, setImageError] = useState(false)

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB')
      return
    }

    setError('')
    setUploadSuccess(false)
    setImageError(false)
    setUploading(true)
    
    try {
      console.log('Uploading avatar during profile setup...')
      const { data: uploadedUrl, error: uploadError } = await onUploadAvatar(file)
      
      if (uploadError) {
        console.error('Avatar upload failed:', uploadError)
        setError('Failed to upload avatar: ' + uploadError.message)
        // Create a preview URL so user can still see their selection
        const previewUrl = URL.createObjectURL(file)
        setAvatarUrl(previewUrl)
      } else if (uploadedUrl) {
        console.log('Avatar uploaded successfully:', uploadedUrl)
        setAvatarUrl(uploadedUrl)
        setUploadSuccess(true)
        setError('')
      }
    } catch (err: unknown) {
      console.error('Avatar upload error:', err)
      setError('Failed to upload avatar')
      // Create a preview URL so user can still see their selection
      const previewUrl = URL.createObjectURL(file)
      setAvatarUrl(previewUrl)
    } finally {
      setUploading(false)
    }
  }

  const handleImageError = () => {
    console.warn('Profile preview image failed to load:', avatarUrl)
    setImageError(true)
  }

  const handleImageLoad = () => {
    console.log('Profile preview image loaded successfully:', avatarUrl)
    setImageError(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      setError('Name is required')
      return
    }

    setError('')
    
    try {
      // Only use the avatar URL if upload was successful
      const finalAvatarUrl = uploadSuccess && avatarUrl ? avatarUrl : undefined

      await onComplete({
        name: name.trim(),
        service_type: serviceType,
        avatar_url: finalAvatarUrl,
        is_volunteer: isVolunteer
      })
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to create profile'))
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-blue-600 p-4 rounded-2xl">
              <User size={40} className="text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-3 font-libre-franklin">
            Set Up Your Profile
          </h1>
          <p className="text-gray-600 text-lg">
            Let's personalize your field service experience
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center space-x-3">
              <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Avatar Upload */}
          <div className="text-center">
            <div className="relative inline-block">
              <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                {avatarUrl && !imageError ? (
                  <img
                    src={avatarUrl}
                    alt="Profile"
                    className="w-full h-full object-cover"
                    onError={handleImageError}
                    onLoad={handleImageLoad}
                  />
                ) : (
                  <User size={32} className="text-gray-400" />
                )}
              </div>
              <label className="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full cursor-pointer transition-colors">
                <Camera size={16} />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                  disabled={loading || uploading}
                />
              </label>
              {uploading && (
                <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
              {uploadSuccess && (
                <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-1">
                  <CheckCircle size={16} />
                </div>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Click the camera icon to upload a profile picture
            </p>
            {uploading && (
              <p className="text-sm text-blue-600 mt-1">Uploading...</p>
            )}
            {uploadSuccess && (
              <p className="text-sm text-green-600 mt-1">✓ Avatar uploaded successfully</p>
            )}
            {imageError && avatarUrl && (
              <p className="text-sm text-red-600 mt-1">Failed to load image preview</p>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What should we call you?
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 bg-white rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none transition-colors"
              placeholder="Enter your name"
              disabled={loading || uploading}
              required
            />
          </div>

          {/* Service Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              What describes you best?
            </label>
            <div className="space-y-3">
              {[
                { value: 'publisher', label: 'Publisher' },
                { value: 'auxiliary_pioneer', label: 'Auxiliary Pioneer' },
                { value: 'regular_pioneer', label: 'Regular Pioneer' }
              ].map((option) => (
                <label
                  key={option.value}
                  className={`block p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    serviceType === option.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      name="serviceType"
                      value={option.value}
                      checked={serviceType === option.value}
                      onChange={(e) =>
                        setServiceType(
                          e.target.value as 'publisher' | 'auxiliary_pioneer' | 'regular_pioneer'
                        )
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      disabled={loading || uploading}
                    />
                    <div>
                      <div className="font-medium text-gray-800">
                        {getServiceTypeLabel(option.value)}
                      </div>
                      <div className="text-sm text-gray-600">
                        {getServiceTypeDescription(option.value)}
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Volunteer status - opt-in, since most publishers hold no volunteer
              assignment and would only be shown a way to log hours they will
              never be given. */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Do you do volunteer work?
            </label>
            <label
              className={`flex items-start space-x-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                isVolunteer
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <input
                type="checkbox"
                checked={isVolunteer}
                onChange={(e) => setIsVolunteer(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                disabled={loading || uploading}
              />
              <div>
                <div className="flex items-center space-x-2 font-medium text-gray-800">
                  <HardHat size={16} className="text-emerald-600" />
                  <span>I do volunteer work</span>
                </div>
                <div className="text-sm text-gray-600">
                  LDC, regional building, disaster relief and similar assignments
                  that award hour credits. You can turn this on later in Settings.
                </div>
              </div>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || uploading || !name.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-4 px-6 rounded-xl font-semibold transition-colors duration-200 flex items-center justify-center space-x-2"
          >
            {loading || uploading ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <User size={20} />
                <span>Complete Setup</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ProfileSetup