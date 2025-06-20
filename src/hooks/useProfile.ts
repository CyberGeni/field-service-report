import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { Profile } from '../types'
import { getServiceTypeTargets } from '../utils/serviceTypes'

export const useProfile = (user: User | null) => {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      fetchProfile()
    } else {
      setProfile(null)
      setLoading(false)
    }
  }, [user])

  const fetchProfile = async () => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (error) {
        throw error
      }

      setProfile(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const createProfile = async (profileData: {
    name: string
    service_type: 'publisher' | 'auxiliary_pioneer' | 'regular_pioneer'
    avatar_url?: string
  }) => {
    if (!user) throw new Error('No user found')

    try {
      setError(null)

      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          ...profileData
        })
        .select()
        .single()

      if (error) throw error

      setProfile(data)
      return { data, error: null }
    } catch (err: any) {
      setError(err.message)
      return { data: null, error: err }
    }
  }

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user || !profile) throw new Error('No user or profile found')

    try {
      setError(null)

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single()

      if (error) throw error

      setProfile(data)
      return { data, error: null }
    } catch (err: any) {
      setError(err.message)
      return { data: null, error: err }
    }
  }

  const uploadAvatar = async (file: File) => {
    if (!user) throw new Error('No user found')

    try {
      setError(null)

      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/avatar.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      return { data: data.publicUrl, error: null }
    } catch (err: any) {
      setError(err.message)
      return { data: null, error: err }
    }
  }

  const getDefaultTargets = (serviceType: string) => {
    return getServiceTypeTargets(serviceType)
  }

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