import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// More detailed error message for debugging
if (!supabaseUrl) {
  console.error('VITE_SUPABASE_URL is missing. Please check your environment variables.')
  console.error('Current environment variables:', {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? '[PRESENT]' : '[MISSING]'
  })
  throw new Error('Missing VITE_SUPABASE_URL environment variable. Please add it to your .env file or deployment environment.')
}

if (!supabaseAnonKey) {
  console.error('VITE_SUPABASE_ANON_KEY is missing. Please check your environment variables.')
  throw new Error('Missing VITE_SUPABASE_ANON_KEY environment variable. Please add it to your .env file or deployment environment.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Helper function to handle auth state
export const getAuthUser = () => {
  return supabase.auth.getUser()
}

// Helper function to get current session
export const getSession = () => {
  return supabase.auth.getSession()
}