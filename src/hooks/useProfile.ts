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

      console.log('Fetching profile for user:', user.id)

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          // No profile found - this is expected for new users
          console.log('No profile found for user:', user.id)
          setProfile(null)
        } else {
          console.error('Error fetching profile:', fetchError)
          setError(fetchError.message)
        }
        return
      }

      console.log('Profile fetched successfully:', data)
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

      console.log('Creating profile with data:', profileData)

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

      console.log('Profile created successfully:', data)
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

      console.log('Updating profile with:', updates)

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

      console.log('Profile updated successfully:', data)
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

      console.log('Starting avatar upload for file:', file.name, 'Size:', file.size, 'Type:', file.type)

      // Validate file
      if (!file.type.startsWith('image/')) {
        throw new Error('File must be an image')
      }

      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File size must be less than 5MB')
      }

      // Create a unique filename with timestamp to avoid caching issues
      const fileExt = file.name.split('.').pop()?.toLowerCase()
      const timestamp = Date.now()
      const fileName = `${user.id}/${timestamp}.${fileExt}`

      console.log('Uploading to storage path:', fileName)

      // Clean up existing avatar files for this user
      try {
        const { data: existingFiles } = await supabase.storage
          .from('avatars')
          .list(user.id)

        if (existingFiles && existingFiles.length > 0) {
          console.log('Found existing avatar files, removing them:', existingFiles.map(f => f.name))
          const filesToDelete = existingFiles.map(file => `${user.id}/${file.name}`)
          await supabase.storage
            .from('avatars')
            .remove(filesToDelete)
          console.log('Cleaned up existing avatar files')
        }
      } catch (cleanupError) {
        console.warn('Could not clean up existing avatars (this is okay):', cleanupError)
      }

      // Upload the new file
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type
        })

      if (uploadError) {
        console.error('Storage upload error:', uploadError)
        throw new Error(`Upload failed: ${uploadError.message}`)
      }

      console.log('File uploaded successfully to storage:', uploadData)

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      console.log('Generated public URL:', publicUrl)

      // Test the URL accessibility
      try {
        const response = await fetch(publicUrl, { method: 'HEAD' })
        if (!response.ok) {
          console.warn('Avatar URL verification failed:', response.status, response.statusText)
        } else {
          console.log('Avatar URL verified as accessible')
        }
      } catch (fetchError) {
        console.warn('Could not verify avatar URL accessibility:', fetchError)
      }

      // Return the clean URL without cache busting for storage
      return { data: publicUrl, error: null }
    } catch (err: any) {
      console.error('Avatar upload error:', err)
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