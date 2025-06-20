import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export interface Profile {
  id: string
  name: string
  avatar_url?: string
  service_type: 'publisher' | 'auxiliary_pioneer' | 'regular_pioneer'
  created_at?: string
  updated_at?: string
}

export function useProfile(user: any) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProfile = async () => {
    try {
      setLoading(true)
      setError(null)

      if (!user) {
        setProfile(null)
        return
      }

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          // No profile found - this is expected for new users
          setProfile(null)
        } else {
          console.error('Error fetching profile:', fetchError)
          setError(fetchError.message)
        }
        return
      }

      setProfile(data)
    } catch (err) {
      console.error('Unexpected error fetching profile:', err)
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const createProfile = async (profileData: Omit<Profile, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      if (!user) {
        throw new Error('No authenticated user')
      }

      const { data, error: createError } = await supabase
        .from('profiles')
        .insert([
          {
            id: user.id,
            ...profileData
          }
        ])
        .select()
        .single()

      if (createError) {
        console.error('Error creating profile:', createError)
        throw createError
      }

      setProfile(data)
      return data
    } catch (err) {
      console.error('Error creating profile:', err)
      throw err
    }
  }

  const updateProfile = async (updates: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>) => {
    try {
      if (!user || !profile) {
        throw new Error('No authenticated user or profile')
      }

      const { data, error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating profile:', updateError)
        throw updateError
      }

      setProfile(data)
      return data
    } catch (err) {
      console.error('Error updating profile:', err)
      throw err
    }
  }

  const uploadAvatar = async (file: File) => {
    try {
      if (!user) {
        throw new Error('No authenticated user')
      }

      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${fileExt}`

      const { data, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          upsert: true
        })

      if (uploadError) {
        throw uploadError
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      return { data: publicUrl, error: null }
    } catch (err: any) {
      console.error('Error uploading avatar:', err)
      return { data: null, error: err }
    }
  }

  const getDefaultTargets = (serviceType: string) => {
    switch (serviceType) {
      case 'auxiliary_pioneer':
        return { monthlyTarget: 30, yearlyTarget: 360 };
      case 'regular_pioneer':
        return { monthlyTarget: 50, yearlyTarget: 600 };
      default:
        return { monthlyTarget: 10, yearlyTarget: 120 };
    }
  }

  useEffect(() => {
    fetchProfile()
  }, [user])

  return {
    profile,
    loading,
    error,
    createProfile,
    updateProfile,
    uploadAvatar,
    getDefaultTargets,
    refetch: fetchProfile
  }
}