import React, { useState } from 'react'
import { ArrowLeft, Eye, EyeOff, Mail, Lock, User, AlertCircle, CheckCircle } from 'lucide-react'
import { AuthError } from '@supabase/supabase-js'

interface SignUpFormProps {
  onBack: () => void
  onSignUp: (email: string, password: string) => Promise<{ error: AuthError | null }>
}

interface FormErrors {
  email?: string
  password?: string
  confirmPassword?: string
  general?: string
}

const SignUpForm: React.FC<SignUpFormProps> = ({ onBack, onSignUp }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [success, setSuccess] = useState(false)

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    // Email validation
    if (!email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    // Password validation
    if (!password) {
      newErrors.password = 'Password is required'
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      newErrors.password = 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    }

    // Confirm password validation
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password'
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const getErrorMessage = (error: AuthError): string => {
    console.log('Auth error details:', error)
    
    // Handle specific Supabase auth error codes and messages
    const message = error.message?.toLowerCase() || ''
    
    // Check for existing user - this is the most common signup error
    if (message.includes('user already registered') || 
        message.includes('email already registered') ||
        message.includes('email already exists') ||
        message.includes('already been registered') ||
        message.includes('user with this email already exists') ||
        message.includes('duplicate')) {
      return 'An account with this email address already exists. Please sign in instead or use a different email.'
    }
    
    // Check for invalid email format
    if (message.includes('invalid email') || 
        message.includes('email format')) {
      return 'Please enter a valid email address.'
    }
    
    // Check for password issues
    if (message.includes('weak password') || 
        message.includes('password too weak') ||
        message.includes('password must be') ||
        message.includes('password should be')) {
      return 'Password is too weak. Please use at least 6 characters with uppercase, lowercase, and numbers.'
    }
    
    // Check for signup disabled
    if (message.includes('signup disabled') || 
        message.includes('signups not allowed') ||
        message.includes('registration disabled')) {
      return 'New account registration is currently disabled. Please contact support.'
    }
    
    // Check for rate limiting
    if (message.includes('email rate limit exceeded') || 
        message.includes('rate limit') ||
        message.includes('too many requests') ||
        message.includes('too many signup attempts')) {
      return 'Too many signup attempts. Please wait a few minutes before trying again.'
    }
    
    // Check for network errors
    if (message.includes('network') || 
        message.includes('fetch') ||
        message.includes('connection') ||
        error.name === 'NetworkError') {
      return 'Network error. Please check your internet connection and try again.'
    }
    
    // Check for domain restrictions
    if (message.includes('invalid') && message.includes('domain')) {
      return 'Email domain is not allowed. Please use a different email address.'
    }
    
    // Check for captcha issues
    if (message.includes('captcha') || 
        message.includes('verification')) {
      return 'Security verification failed. Please try again.'
    }
    
    // For any other errors, check for common patterns
    if (message.includes('invalid')) {
      return 'Please check your email address and try again.'
    }
    
    if (message.includes('password')) {
      return 'Password requirements not met. Please use at least 6 characters with uppercase, lowercase, and numbers.'
    }
    
    // If we have a short, readable error message, use it
    if (error.message && error.message.length < 100 && !error.message.includes('Error:')) {
      return error.message
    }
    
    // Fallback for truly unexpected errors
    return 'Unable to create account. Please check your information and try again.'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setLoading(true)
    setErrors({})

    try {
      const { error } = await onSignUp(email, password)
      
      if (error) {
        setErrors({ general: getErrorMessage(error) })
      } else {
        setSuccess(true)
      }
    } catch (err: any) {
      console.error('Sign up error:', err)
      setErrors({ 
        general: 'An unexpected error occurred. Please try again.' 
      })
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="bg-green-100 p-4 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <CheckCircle size={40} className="text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Check Your Email</h1>
          <p className="text-gray-600 mb-8">
            We've sent a confirmation link to <strong>{email}</strong>. 
            Please click the link in your email to activate your account.
          </p>
          <button
            onClick={onBack}
            className="bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-xl font-semibold transition-colors duration-200"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="flex items-center mb-8">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-white/50 transition-colors mr-4"
          >
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Create Account</h1>
            <p className="text-gray-600">Join Field Service Tracker</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* General Error */}
          {errors.general && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3">
              <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-700 text-sm font-medium">Account Creation Failed</p>
                <p className="text-red-600 text-sm mt-1">{errors.general}</p>
              </div>
            </div>
          )}

          {/* Email Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full pl-10 pr-4 py-3 bg-white rounded-xl border-2 transition-colors focus:outline-none ${
                  errors.email 
                    ? 'border-red-300 focus:border-red-500' 
                    : 'border-gray-200 focus:border-blue-500'
                }`}
                placeholder="Enter your email"
                disabled={loading}
              />
            </div>
            {errors.email && (
              <p className="text-red-600 text-sm mt-1">{errors.email}</p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full pl-10 pr-12 py-3 bg-white rounded-xl border-2 transition-colors focus:outline-none ${
                  errors.password 
                    ? 'border-red-300 focus:border-red-500' 
                    : 'border-gray-200 focus:border-blue-500'
                }`}
                placeholder="Create a password"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                disabled={loading}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.password && (
              <p className="text-red-600 text-sm mt-1">{errors.password}</p>
            )}
            <p className="text-gray-500 text-xs mt-1">
              Must be at least 6 characters with uppercase, lowercase, and number
            </p>
          </div>

          {/* Confirm Password Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <Lock size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full pl-10 pr-12 py-3 bg-white rounded-xl border-2 transition-colors focus:outline-none ${
                  errors.confirmPassword 
                    ? 'border-red-300 focus:border-red-500' 
                    : 'border-gray-200 focus:border-blue-500'
                }`}
                placeholder="Confirm your password"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                disabled={loading}
              >
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-red-600 text-sm mt-1">{errors.confirmPassword}</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 px-6 rounded-xl font-semibold transition-colors duration-200 flex items-center justify-center"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'Create Account'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

export default SignUpForm