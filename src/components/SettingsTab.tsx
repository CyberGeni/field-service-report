import React, { useState, useEffect } from 'react';
import { User, Target, Calendar, LogOut, Camera, Edit, X, Plus, Trash2, Briefcase, BaggageClaim, RefreshCw } from 'lucide-react';
import { Settings, Profile, FieldServiceDay } from '../types';
import { getServiceTypeTargets, getServiceTypeLabel, getServiceTypeDescription, hasHourRequirement } from '../utils/serviceTypes';
import { useToast } from './ui/toast';

interface SettingsTabProps {
  settings: Settings;
  profile?: Profile | null;
  onUpdateSettings: (settings: Partial<Settings>) => void;
  onUpdateProfile?: (updates: Partial<Profile>) => Promise<void>;
  onUploadAvatar?: (file: File) => Promise<{ data: string | null; error: any }>;
  onSignOut: () => Promise<{ error: any }>;
  onForceRefresh?: () => Promise<void>;
}

interface EditProfileModalProps {
  profile: Profile;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: Partial<Profile>) => Promise<void>;
  onUploadAvatar?: (file: File) => Promise<{ data: string | null; error: any }>;
}

interface EditFieldServiceDayModalProps {
  fieldServiceDay: FieldServiceDay | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (day: FieldServiceDay) => void;
  existingDays: FieldServiceDay[];
}

const EditFieldServiceDayModal: React.FC<EditFieldServiceDayModalProps> = ({
  fieldServiceDay,
  isOpen,
  onClose,
  onSave,
  existingDays
}) => {
  const [localDay, setLocalDay] = useState<FieldServiceDay>({
    day: 0,
    type: 'h2h',
    potentialHours: 2,
    label: 'Sunday - House to House/Return Visits'
  });
  const [error, setError] = useState('');
  const { addToast } = useToast();

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Reset local state when modal opens/closes or fieldServiceDay changes
  useEffect(() => {
    if (isOpen) {
      if (fieldServiceDay) {
        // Editing existing day - load its data
        setLocalDay({ ...fieldServiceDay });
      } else {
        // Adding new day - find first available day
        const usedDays = existingDays.map(day => day.day);
        const firstAvailableDay = [0, 1, 2, 3, 4, 5, 6].find(day => !usedDays.includes(day)) || 0;
        
        setLocalDay({
          day: firstAvailableDay,
          type: 'h2h',
          potentialHours: 2,
          label: `${dayNames[firstAvailableDay]} - House to House/Return Visits`
        });
      }
      setError('');
    }
  }, [isOpen, fieldServiceDay, existingDays]);

  const handleSave = () => {
    // Validate potential hours
    if (!localDay.potentialHours || localDay.potentialHours <= 0) {
      setError('Hours must be greater than 0');
      addToast({
        type: 'error',
        title: 'Invalid Hours',
        description: 'Hours must be greater than 0'
      });
      return;
    }

    // Check for duplicate days (only if this is a new day or day changed)
    if (!fieldServiceDay || fieldServiceDay.day !== localDay.day) {
      const isDuplicate = existingDays.some(day => 
        day.day === localDay.day && (!fieldServiceDay || day !== fieldServiceDay)
      );
      
      if (isDuplicate) {
        setError(`${dayNames[localDay.day]} is already configured`);
        addToast({
          type: 'error',
          title: 'Duplicate Day',
          description: `${dayNames[localDay.day]} is already configured`
        });
        return;
      }
    }

    // Update label
    const updatedDay = {
      ...localDay,
      label: `${dayNames[localDay.day]} - ${localDay.type === 'h2h' ? 'House to House/Return Visits' : 'Cart Witnessing'}`
    };

    onSave(updatedDay);
    addToast({
      type: 'success',
      title: 'Day Updated',
      description: `${dayNames[updatedDay.day]} configuration saved successfully`
    });
    onClose();
  };

  // Get available days for dropdown
  const getAvailableDays = () => {
    const usedDays = existingDays
      .filter(day => !fieldServiceDay || day !== fieldServiceDay)
      .map(day => day.day);
    
    return dayNames.map((name, index) => ({
      value: index,
      label: name,
      disabled: usedDays.includes(index)
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-800">
              {fieldServiceDay ? 'Edit Field Service Day' : 'Add Field Service Day'}
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Day of Week</label>
              <select
                value={localDay.day}
                onChange={(e) => setLocalDay(prev => ({ 
                  ...prev, 
                  day: parseInt(e.target.value)
                }))}
                className="w-full p-3 bg-gray-50 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {getAvailableDays().map((option) => (
                  <option 
                    key={option.value} 
                    value={option.value}
                    disabled={option.disabled}
                    className={option.disabled ? 'text-gray-400' : ''}
                  >
                    {option.label} {option.disabled ? '(already configured)' : ''}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Service Type</label>
              <select
                value={localDay.type}
                onChange={(e) => setLocalDay(prev => ({ 
                  ...prev, 
                  type: e.target.value as 'h2h' | 'cart'
                }))}
                className="w-full p-3 bg-gray-50 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="h2h">House to House / Return Visits</option>
                <option value="cart">Cart Witnessing</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Hours</label>
              <input
                type="number"
                min="0.5"
                max="12"
                step="0.5"
                value={localDay.potentialHours || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    setLocalDay(prev => ({ ...prev, potentialHours: 0 }));
                  } else {
                    const numValue = parseFloat(value);
                    if (!isNaN(numValue) && numValue >= 0.5) {
                      setLocalDay(prev => ({ ...prev, potentialHours: numValue }));
                    }
                  }
                }}
                placeholder="Enter hours"
                className="w-full p-3 bg-gray-50 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 px-4 rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!localDay.potentialHours || localDay.potentialHours <= 0}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 px-4 rounded-xl font-medium transition-colors"
            >
              {fieldServiceDay ? 'Save Changes' : 'Add Day'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const EditProfileModal: React.FC<EditProfileModalProps> = ({
  profile,
  isOpen,
  onClose,
  onSave,
  onUploadAvatar
}) => {
  const [localProfile, setLocalProfile] = useState(profile);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { addToast } = useToast();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadAvatar) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    setUploading(true);
    setError('');
    try {
      const { data: avatarUrl, error: uploadError } = await onUploadAvatar(file);
      
      if (uploadError) {
        setError('Failed to upload avatar: ' + uploadError.message);
        addToast({
          type: 'error',
          title: 'Upload Failed',
          description: 'Failed to upload avatar image'
        });
        return;
      }

      if (avatarUrl) {
        setLocalProfile(prev => ({ ...prev, avatar_url: avatarUrl }));
        addToast({
          type: 'success',
          title: 'Avatar Uploaded',
          description: 'Profile picture uploaded successfully'
        });
      }
    } catch (error) {
      console.error('Avatar upload error:', error);
      setError('Failed to upload avatar');
      addToast({
        type: 'error',
        title: 'Upload Error',
        description: 'An unexpected error occurred'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!localProfile.name.trim()) {
      setError('Name is required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onSave({
        name: localProfile.name,
        service_type: localProfile.service_type,
        avatar_url: localProfile.avatar_url
      });
      addToast({
        type: 'success',
        title: 'Profile Updated',
        description: 'Your profile has been updated successfully'
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
      addToast({
        type: 'error',
        title: 'Update Failed',
        description: 'Failed to update profile'
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-800">Edit Profile</h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* Avatar */}
            <div className="text-center">
              <div className="relative inline-block">
                <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {localProfile.avatar_url ? (
                    <img
                      src={localProfile.avatar_url}
                      alt={localProfile.name}
                      className="w-full h-full object-cover rounded-full"
                      style={{ aspectRatio: '1 / 1' }}
                    />
                  ) : (
                    <User size={28} className="text-gray-400" />
                  )}
                </div>
                {onUploadAvatar && (
                  <label className="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-700 text-white p-1.5 rounded-full cursor-pointer transition-colors">
                    <Camera size={14} />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                      disabled={uploading || saving}
                    />
                  </label>
                )}
              </div>
              {uploading && (
                <p className="text-sm text-blue-600 mt-2">Uploading...</p>
              )}
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
              <input
                type="text"
                value={localProfile.name}
                onChange={(e) => setLocalProfile(prev => ({ ...prev, name: e.target.value }))}
                className="w-full p-3 bg-gray-50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                placeholder="Enter your name"
                disabled={saving}
              />
            </div>

            {/* Service Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Service Type</label>
              <div className="space-y-2">
                {[
                  { value: 'publisher', label: 'Publisher' },
                  { value: 'auxiliary_pioneer', label: 'Auxiliary Pioneer' },
                  { value: 'regular_pioneer', label: 'Regular Pioneer' }
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`block p-3 rounded-xl border cursor-pointer transition-all ${
                      localProfile.service_type === option.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <input
                          type="radio"
                          name="serviceType"
                          value={option.value}
                          checked={localProfile.service_type === option.value}
                          onChange={(e) => setLocalProfile(prev => ({ 
                            ...prev, 
                            service_type: e.target.value as 'publisher' | 'auxiliary_pioneer' | 'regular_pioneer'
                          }))}
                          className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                          disabled={saving}
                        />
                        <span className="font-medium text-gray-800">{option.label}</span>
                      </div>
                      <span className="text-sm text-gray-600">
                        {getServiceTypeDescription(option.value)}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-3 mt-6">
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-800 py-3 px-4 rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !localProfile.name.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 px-4 rounded-xl font-medium transition-colors flex items-center justify-center"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const SettingsTab: React.FC<SettingsTabProps> = ({ 
  settings, 
  profile,
  onUpdateSettings, 
  onUpdateProfile,
  onUploadAvatar,
  onSignOut,
  onForceRefresh
}) => {
  const [localSettings, setLocalSettings] = useState(settings);
  const [signingOut, setSigningOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFieldServiceModal, setShowFieldServiceModal] = useState(false);
  const [editingFieldServiceDay, setEditingFieldServiceDay] = useState<FieldServiceDay | null>(null);
  const { addToast } = useToast();

  // Update local settings when props change
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleForceRefresh = async () => {
    if (!onForceRefresh) return;
    
    setRefreshing(true);
    try {
      await onForceRefresh();
      addToast({
        type: 'success',
        title: 'Data Refreshed',
        description: 'Settings have been synchronized with the server'
      });
    } catch (error) {
      console.error('Force refresh error:', error);
      addToast({
        type: 'error',
        title: 'Refresh Failed',
        description: 'Failed to refresh data from server'
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await onSignOut();
      addToast({
        type: 'info',
        title: 'Signed Out',
        description: 'You have been signed out successfully'
      });
    } catch (error) {
      console.error('Sign out error:', error);
      addToast({
        type: 'error',
        title: 'Sign Out Failed',
        description: 'Failed to sign out'
      });
    } finally {
      setSigningOut(false);
    }
  };

  const handleProfileUpdate = async (updates: Partial<Profile>) => {
    if (onUpdateProfile) {
      await onUpdateProfile(updates);
    }
  };

  const handleEditFieldServiceDay = (day: FieldServiceDay) => {
    setEditingFieldServiceDay(day);
    setShowFieldServiceModal(true);
  };

  const handleAddFieldServiceDay = () => {
    setEditingFieldServiceDay(null);
    setShowFieldServiceModal(true);
  };

  const handleDeleteFieldServiceDay = async (dayToDelete: FieldServiceDay) => {
    try {
      const updatedDays = localSettings.fieldServiceDays.filter(day => day !== dayToDelete);
      const updatedSettings = { ...localSettings, fieldServiceDays: updatedDays };
      setLocalSettings(updatedSettings);
      await onUpdateSettings(updatedSettings);
      
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      addToast({
        type: 'success',
        title: 'Day Removed',
        description: `${dayNames[dayToDelete.day]} has been removed from your field service days`
      });
    } catch (error) {
      console.error('Error deleting field service day:', error);
      addToast({
        type: 'error',
        title: 'Delete Failed',
        description: 'Failed to remove field service day'
      });
    }
  };

  const handleFieldServiceDayUpdate = async (updatedDay: FieldServiceDay) => {
    try {
      let updatedDays;
      
      if (editingFieldServiceDay) {
        // Update existing day
        updatedDays = localSettings.fieldServiceDays.map(day => 
          day === editingFieldServiceDay ? updatedDay : day
        );
      } else {
        // Add new day
        updatedDays = [...localSettings.fieldServiceDays, updatedDay];
      }
      
      const updatedSettings = { ...localSettings, fieldServiceDays: updatedDays };
      setLocalSettings(updatedSettings);
      await onUpdateSettings(updatedSettings);
    } catch (error) {
      console.error('Error updating field service day:', error);
      addToast({
        type: 'error',
        title: 'Update Failed',
        description: 'Failed to save field service day'
      });
    }
  };

  const handleTargetChange = async (field: 'monthlyTarget' | 'yearlyTarget', value: number) => {
    try {
      const updatedSettings = { ...localSettings, [field]: value };
      setLocalSettings(updatedSettings);
      await onUpdateSettings(updatedSettings);
      addToast({
        type: 'success',
        title: 'Target Updated',
        description: `${field === 'monthlyTarget' ? 'Monthly' : 'Yearly'} target updated successfully`
      });
    } catch (error) {
      console.error('Error updating target:', error);
      addToast({
        type: 'error',
        title: 'Update Failed',
        description: 'Failed to save target'
      });
    }
  };

  const handleServiceYearChange = async (value: string) => {
    try {
      const updatedSettings = { ...localSettings, serviceYearStart: value };
      setLocalSettings(updatedSettings);
      await onUpdateSettings(updatedSettings);
      addToast({
        type: 'success',
        title: 'Service Year Updated',
        description: 'Service year start date updated successfully'
      });
    } catch (error) {
      console.error('Error updating service year:', error);
      addToast({
        type: 'error',
        title: 'Update Failed',
        description: 'Failed to save service year'
      });
    }
  };

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Check if current service type has requirements
  const serviceTypeHasRequirements = profile?.service_type && hasHourRequirement(profile.service_type);
  
  // Get current targets based on service type
  const currentTargets = serviceTypeHasRequirements 
    ? getServiceTypeTargets(profile.service_type)
    : { monthlyTarget: localSettings.monthlyTarget, yearlyTarget: localSettings.yearlyTarget };

  return (
    <div className="space-y-6">
      {/* Sync Status & Refresh */}
      <div className="bg-white rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <RefreshCw size={24} className="text-green-500" />
            <h3 className="text-lg font-semibold text-gray-800">Data Sync</h3>
          </div>
          <button
            onClick={handleForceRefresh}
            disabled={refreshing}
            className="flex items-center space-x-2 bg-green-50 hover:bg-green-100 disabled:bg-gray-100 text-green-600 disabled:text-gray-400 px-3 py-2 rounded-lg transition-colors"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            <span className="text-sm font-medium">
              {refreshing ? 'Syncing...' : 'Sync Now'}
            </span>
          </button>
        </div>
        
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-green-800 text-sm">
            <strong>Multi-device sync:</strong> Your settings are automatically synchronized across all your devices. 
            If you notice any inconsistencies, use the "Sync Now" button to force a refresh.
          </p>
        </div>
      </div>

      {/* Profile Display Section */}
      {profile && (
        <div className="bg-white rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <User size={24} className="text-blue-500" />
              <h3 className="text-lg font-semibold text-gray-800">Profile</h3>
            </div>
            <button
              onClick={() => setShowEditModal(true)}
              className="flex items-center space-x-2 bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-2 rounded-lg transition-colors"
            >
              <Edit size={16} />
              <span className="text-sm font-medium">Edit</span>
            </button>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.name}
                  className="w-full h-full object-cover rounded-full"
                  style={{ aspectRatio: '1 / 1' }}
                />
              ) : (
                <User size={24} className="text-gray-400" />
              )}
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-lg">{profile.name}</p>
              <p className="text-gray-600">
                {getServiceTypeLabel(profile.service_type)} 
                <span className="text-gray-500 ml-1">
                  ({getServiceTypeDescription(profile.service_type)})
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hour Requirements */}
      <div className="bg-white rounded-xl p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Target size={24} className="text-green-500" />
          <h3 className="text-lg font-semibold text-gray-800">Hour Requirements</h3>
        </div>
        
        {serviceTypeHasRequirements ? (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
            <p className="text-blue-800 font-medium mb-2">
              {getServiceTypeLabel(profile!.service_type)} Requirements
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-blue-600">Monthly:</span>
                <span className="font-semibold ml-2">{currentTargets.monthlyTarget}h</span>
              </div>
              <div>
                <span className="text-blue-600">Yearly:</span>
                <span className="font-semibold ml-2">{currentTargets.yearlyTarget}h</span>
              </div>
            </div>
            <p className="text-xs text-blue-600 mt-2">
              These targets are automatically set based on your service type
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
              <p className="text-green-800 font-medium mb-1">Personal Goals</p>
              <p className="text-xs text-green-600">
                As a publisher, you can set your own personal service goals
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Target (hours)</label>
              <input
                type="number"
                min="1"
                max="100"
                value={localSettings.monthlyTarget}
                onChange={(e) => handleTargetChange('monthlyTarget', parseInt(e.target.value) || 10)}
                className="w-full p-3 bg-gray-50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Yearly Target (hours)</label>
              <input
                type="number"
                min="12"
                max="1000"
                value={localSettings.yearlyTarget}
                onChange={(e) => handleTargetChange('yearlyTarget', parseInt(e.target.value) || 120)}
                className="w-full p-3 bg-gray-50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
              />
            </div>
          </div>
        )}
        
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Service Year Start</label>
          <input
            type="month"
            value={localSettings.serviceYearStart}
            onChange={(e) => handleServiceYearChange(e.target.value)}
            className="w-full p-3 bg-gray-50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
          />
        </div>
      </div>

      {/* Field Service Days */}
      <div className="bg-white rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Calendar size={24} className="text-purple-500" />
            <h3 className="text-lg font-semibold text-gray-800">Field Service Days</h3>
          </div>
          <button
            onClick={handleAddFieldServiceDay}
            disabled={localSettings.fieldServiceDays.length >= 7}
            className="flex items-center space-x-2 bg-purple-50 hover:bg-purple-100 disabled:bg-gray-100 disabled:text-gray-400 text-purple-600 px-3 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} />
            <span className="text-sm font-medium">
              {localSettings.fieldServiceDays.length >= 7 ? 'All Days Added' : 'Add Day'}
            </span>
          </button>
        </div>
        
        {localSettings.fieldServiceDays.length > 0 ? (
          <div className="grid gap-3">
            {localSettings.fieldServiceDays.map((fieldDay, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-gray-800">
                    {dayNames[fieldDay.day]}
                  </p>
                  <p className="text-sm text-gray-600">
                    {fieldDay.type === 'h2h' ? 'House to House/Return Visits' : 'Cart Witnessing'} • {fieldDay.potentialHours}h
                  </p>
                </div>
                <div className="flex items-center">
                  <button
                    onClick={() => handleEditFieldServiceDay(fieldDay)}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit day"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteFieldServiceDay(fieldDay)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete day"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Calendar size={48} className="mx-auto mb-4 opacity-50" />
            <p className="font-medium">No field service days configured</p>
            <p className="text-sm">Add your typical field service days to get scheduling suggestions</p>
          </div>
        )}
      </div>

      {/* Sign Out Section - Moved to bottom */}
      <div className="bg-white rounded-xl p-6">
        <div className="flex items-center space-x-3 mb-4">
          <LogOut size={24} className="text-red-500" />
          <h3 className="text-lg font-semibold text-gray-800">Account</h3>
        </div>
        
        <div className="space-y-3">
          <p className="text-gray-600 text-sm">
            Sign out of your account to switch users or for security purposes.
          </p>
          
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white py-3 px-4 rounded-xl font-medium transition-colors duration-200 flex items-center justify-center space-x-2"
          >
            {signingOut ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <LogOut size={20} />
                <span>Sign Out</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {profile && (
        <EditProfileModal
          profile={profile}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSave={handleProfileUpdate}
          onUploadAvatar={onUploadAvatar}
        />
      )}

      {/* Edit Field Service Day Modal */}
      <EditFieldServiceDayModal
        fieldServiceDay={editingFieldServiceDay}
        isOpen={showFieldServiceModal}
        onClose={() => {
          setShowFieldServiceModal(false);
          setEditingFieldServiceDay(null);
        }}
        onSave={handleFieldServiceDayUpdate}
        existingDays={localSettings.fieldServiceDays}
      />
    </div>
  );
};

export default SettingsTab;