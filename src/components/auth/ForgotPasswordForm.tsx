import React, { useState } from 'react'
import { ArrowLeft, Mail, AlertCircle, CheckCircle } from 'lucide-react'
import { AuthError } from '@supabase/supabase-js'

interface ForgotPasswordFormProps {
  onBack: () => void
  onResetPassword: (email: string) => Promise<{ error: AuthError | null }>
}

const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({ onBack, onResetPassword }) => {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const getErrorMessage = (error: AuthError): string => {
    // Handle specific Supabase auth error codes and messages
    const message = error.message.toLowerCase()
    
    if (message.includes('user not found') || 
        message.includes('email not found') ||
        message.includes('no user found')) {
      return 'No account found with this email address. Please check the email or create a new account.'
    }
    
    if (message.includes('invalid email') ||
        message.includes('invalid login credentials')) {
      return 'Please enter a valid email address.'
    }
    
    if (message.includes('email rate limit exceeded') || 
        message.includes('rate limit') ||
        message.includes('too many requests')) {
      return 'Too many password reset requests. Please wait a few minutes before trying again.'
    }
    
    if (message.includes('network') || message.includes('fetch')) {
      return 'Network error. Please check your internet connection and try again.'
    }
    
    if (message.includes('service unavailable') || message.includes('temporarily unavailable')) {
      return 'Password reset service is temporarily unavailable. Please try again later.'
    }
    
    // For any other errors, show the original message if it's user-friendly
    if (error.message && error.message.length < 100 && !error.message.includes('Error')) {
      return error.message
    }
    
    // Fallback for truly unexpected errors
    return 'Unable to send password reset email. Please try again or contact support.'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email.trim()) {
      setError('Email is required')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address')
      return
    }

    setLoading(true)
    setError('')

    const { error } = await onResetPassword(email)
    
    if (error) {
      setError(getErrorMessage(error))
    } else {
      setSuccess(true)
    }
    
    setLoading(false)
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
            We've sent a password reset link to <strong>{email}</strong>. 
            Please check your email and follow the instructions to reset your password.
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
            <h1 className="text-2xl font-bold text-gray-800">Reset Password</h1>
            <p className="text-gray-600">Enter your email to reset your password</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3">
              <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-700 text-sm font-medium">Reset Failed</p>
                <p className="text-red-600 text-sm mt-1">{error}</p>
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
                className="w-full pl-10 pr-4 py-3 bg-white rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none transition-colors"
                placeholder="Enter your email"
                disabled={loading}
              />
            </div>
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
              'Send Reset Link'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ForgotPasswordForm