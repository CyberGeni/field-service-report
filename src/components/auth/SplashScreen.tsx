import React from 'react'
import { Clock, Target, Calendar } from 'lucide-react'

interface SplashScreenProps {
  onSignIn: () => void
  onSignUp: () => void
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onSignIn, onSignUp }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        {/* Logo and Title */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-blue-600 p-4 rounded-2xl">
              <Clock size={40} className="text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-3 font-libre-franklin">
            Field Service Tracker
          </h1>
          <p className="text-gray-600 text-lg">
            Track your ministry hours with ease
          </p>
        </div>

        {/* Features */}
        <div className="space-y-4 mb-12">
          <div className="flex items-center space-x-4 bg-white/60 backdrop-blur-sm rounded-xl p-4">
            <div className="bg-green-100 p-2 rounded-lg">
              <Target size={20} className="text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Track Goals</h3>
              <p className="text-sm text-gray-600">Monitor monthly and yearly targets</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4 bg-white/60 backdrop-blur-sm rounded-xl p-4">
            <div className="bg-purple-100 p-2 rounded-lg">
              <Calendar size={20} className="text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Calendar View</h3>
              <p className="text-sm text-gray-600">Visualize your service schedule</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4 bg-white/60 backdrop-blur-sm rounded-xl p-4">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Clock size={20} className="text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Time Tracking</h3>
              <p className="text-sm text-gray-600">Built-in timer and manual entry</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          <button
            onClick={onSignIn}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 px-6 rounded-xl font-semibold text-lg transition-colors duration-200 transform hover:scale-[1.02]"
          >
            Sign In
          </button>
          
          <button
            onClick={onSignUp}
            className="w-full bg-white hover:bg-gray-50 text-gray-800 py-4 px-6 rounded-xl font-semibold text-lg transition-colors duration-200 transform hover:scale-[1.02] border-2 border-gray-200"
          >
            Create Account
          </button>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            Secure cloud sync • Available offline
          </p>
        </div>
      </div>
    </div>
  )
}

export default SplashScreen