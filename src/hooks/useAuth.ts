import { useState, useEffect } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

// The session as last seen by any screen. Every component calls this hook for itself,
// and one opened later would otherwise start from "nobody signed in" until its own
// check comes back - long enough to flash an empty list at someone who has plenty.
// undefined until the first check finishes.
let knownSession: Session | null | undefined

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => knownSession?.user ?? null)
  const [session, setSessionState] = useState<Session | null>(() => knownSession ?? null)
  const [loading, setLoading] = useState(knownSession === undefined)

  const setSession = (next: Session | null) => {
    knownSession = next
    setSessionState(next)
  }

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error)
          
          // Check if the error is due to an invalid refresh token
          if (error.message?.includes('Refresh Token Not Found') || 
              error.message?.includes('Invalid Refresh Token')) {
            console.log('Invalid refresh token detected, clearing session...')
            // Clear the invalid session from local storage
            await supabase.auth.signOut()
          }
        } else {
          setSession(session)
          setUser(session?.user ?? null)
        }
      } catch (err) {
        console.error('Unexpected error getting session:', err)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event)
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    console.log('Attempting sign in')
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    console.log('Sign in result:', error ? error.message : 'ok')

    // Return the result object - don't throw errors
    return { data, error }
  }

  const signUp = async (email: string, password: string) => {
    console.log('Attempting sign up')
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    console.log('Sign up result:', error ? error.message : 'ok')

    // Return the result object - don't throw errors
    return { data, error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    
    // Return the result object - don't throw errors
    return { error }
  }

  const resetPassword = async (email: string) => {
    console.log('Attempting password reset')
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    console.log('Password reset result:', { error })

    // Return the result object - don't throw errors
    return { error }
  }

  return {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
  }
}