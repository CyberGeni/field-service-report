import React, { useState } from 'react'
import { ArrowLeft, Eye, EyeOff, Mail, Lock, AlertCircle } from 'lucide-react'
import { AuthError } from '@supabase/supabase-js'

interface SignInFormProps {
  onBack: () => void
  onSignIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  onForgotPassword: () => void
}

interface FormErrors {
  email?: string
  password?: string
  general?: string
}

const SignInForm: React.FC<SignInFormProps> = ({ onBack, onSignIn, onForgotPassword }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})

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
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const getErrorMessage = (error: AuthError): string => {
    // Handle specific Supabase auth error codes and messages
    const message = error.message.toLowerCase()
    
    if (message.includes('invalid login credentials') || 
        message.includes('invalid email or password') ||
        message.includes('email not confirmed')) {
      return 'Invalid email or password. Please check your credentials and try again.'
    }
    
    if (message.includes('email not confirmed')) {
      return 'Please check your email and click the confirmation link before signing in.'
    }
    
    if (message.includes('too many requests')) {
      return 'Too many login attempts. Please wait a few minutes before trying again.'
    }
    
    if (message.includes('signup disabled')) {
      return 'New account registration is currently disabled.'
    }
    
    if (message.includes('email rate limit exceeded')) {
      return 'Too many emails sent. Please wait before requesting another.'
    }
    
    if (message.includes('network') || message.includes('fetch')) {
      return 'Network error. Please check your internet connection and try again.'
    }
    
    if (message.includes('weak password')) {
      return 'Password is too weak. Please choose a stronger password.'
    }
    
    // For any other errors, show the original message if it's user-friendly
    if (error.message && error.message.length < 100 && !error.message.includes('Error')) {
      return error.message
    }
    
    // Fallback for truly unexpected errors
    return 'Unable to sign in. Please try again or contact support if the problem persists.'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setLoading(true)
    setErrors({})

    try {
      const { error } = await onSignIn(email, password)
      
      if (error) {
        setErrors({ general: getErrorMessage(error) })
      }
    } catch (err: any) {
      console.error('Sign in error:', err)
      setErrors({ 
        general: 'An unexpected error occurred. Please try again.' 
      })
    } finally {
      setLoading(false)
    }
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
            <h1 className="text-2xl font-bold text-gray-800">Welcome Back</h1>
            <p className="text-gray-600">Sign in to your account</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* General Error */}
          {errors.general && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3">
              <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-700 text-sm font-medium">Sign In Failed</p>
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
                placeholder="Enter your password"
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
          </div>

          {/* Forgot Password */}
          <div className="text-right">
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              disabled={loading}
            >
              Forgot your password?
            </button>
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
              'Sign In'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

export default SignInForm