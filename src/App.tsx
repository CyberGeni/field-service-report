import React, { useState, useEffect } from 'react';
import Navigation from './components/Navigation';
import LogTab from './components/LogTab';
import HomeTab from './components/HomeTab';
import CalendarTab from './components/CalendarTab';
import StudentsTab from './components/StudentsTab';
import SettingsTab from './components/SettingsTab';
import SplashScreen from './components/auth/SplashScreen';
import SignInForm from './components/auth/SignInForm';
import SignUpForm from './components/auth/SignUpForm';
import ForgotPasswordForm from './components/auth/ForgotPasswordForm';
import ProfileSetup from './components/ProfileSetup';
import { ToastProvider } from './components/ui/toast';
import { useStorage } from './hooks/useStorage';
import { useTimer } from './hooks/useTimer';
import { useAuth } from './hooks/useAuth';
import { useProfile } from './hooks/useProfile';
import { hasHourRequirement } from './utils/serviceTypes';

type AuthView = 'splash' | 'signin' | 'signup' | 'forgot-password';

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [authView, setAuthView] = useState<AuthView>('splash');
  const { records, settings, loading: storageLoading, saveRecord, updateSettings } = useStorage();
  const { timerState, startTimer, pauseTimer, stopTimer } = useTimer();
  const { user, loading: authLoading, signIn, signUp, signOut, resetPassword } = useAuth();
  const { profile, loading: profileLoading, createProfile, updateProfile, uploadAvatar, getDefaultTargets } = useProfile(user);

  // Register service worker for PWA
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('SW registered: ', registration);
        })
        .catch(registrationError => {
          console.log('SW registration failed: ', registrationError);
        });
    }
  }, []);

  // Update settings when profile changes (only for service types with requirements)
  useEffect(() => {
    if (profile && profile.service_type && hasHourRequirement(profile.service_type)) {
      const defaultTargets = getDefaultTargets(profile.service_type);
      // Only update if current targets match old defaults (haven't been customized)
      if (settings.monthlyTarget === 10 || settings.monthlyTarget === 30 || settings.monthlyTarget === 50) {
        updateSettings({
          monthlyTarget: defaultTargets.monthlyTarget,
          yearlyTarget: defaultTargets.yearlyTarget
        });
      }
    }
  }, [profile?.service_type]);

  // Show loading screen while checking auth or loading data
  if (authLoading || (user && (profileLoading || storageLoading))) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show auth screens if user is not authenticated
  if (!user) {
    switch (authView) {
      case 'signin':
        return (
          <SignInForm
            onBack={() => setAuthView('splash')}
            onSignIn={signIn}
            onForgotPassword={() => setAuthView('forgot-password')}
          />
        );
      case 'signup':
        return (
          <SignUpForm
            onBack={() => setAuthView('splash')}
            onSignUp={signUp}
          />
        );
      case 'forgot-password':
        return (
          <ForgotPasswordForm
            onBack={() => setAuthView('signin')}
            onResetPassword={resetPassword}
          />
        );
      default:
        return (
          <SplashScreen
            onSignIn={() => setAuthView('signin')}
            onSignUp={() => setAuthView('signup')}
          />
        );
    }
  }

  // Show profile setup if user is authenticated but has no profile
  if (user && !profile) {
    const handleProfileComplete = async (profileData: {
      name: string;
      service_type: 'publisher' | 'auxiliary_pioneer' | 'regular_pioneer';
      avatar_url?: string;
    }) => {
      await createProfile(profileData);
      
      // Only update settings with default targets for service types with requirements
      if (hasHourRequirement(profileData.service_type)) {
        const defaultTargets = getDefaultTargets(profileData.service_type);
        updateSettings({
          monthlyTarget: defaultTargets.monthlyTarget,
          yearlyTarget: defaultTargets.yearlyTarget
        });
      }
      // For publishers, keep their existing custom targets
    };

    return (
      <ProfileSetup
        onComplete={handleProfileComplete}
        onUploadAvatar={uploadAvatar}
        loading={profileLoading}
      />
    );
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'log':
        return (
          <LogTab 
            records={records} 
            settings={settings} 
            onSaveRecord={saveRecord}
            timerState={timerState}
            onStartTimer={startTimer}
            onPauseTimer={pauseTimer}
            onStopTimer={stopTimer}
          />
        );
      case 'home':
        return <HomeTab records={records} settings={settings} profile={profile} />;
      case 'calendar':
        return <CalendarTab records={records} settings={settings} />;
      case 'students':
        return <StudentsTab />;
      case 'settings':
        return (
          <SettingsTab 
            settings={settings} 
            profile={profile}
            onUpdateSettings={updateSettings} 
            onUpdateProfile={updateProfile}
            onUploadAvatar={uploadAvatar}
            onSignOut={signOut} 
          />
        );
      default:
        return <HomeTab records={records} settings={settings} profile={profile} />;
    }
  };

  return (
    <ToastProvider>
      <div className="min-h-screen bg-gradient-to-br from-white to-gray-100 pb-20">
        <div className="max-w-md mx-auto">
          {/* Main Content */}
          <main className="p-6 pt-8">
            {renderActiveTab()}
          </main>

          {/* Navigation with timer indicator */}
          <Navigation 
            activeTab={activeTab} 
            onTabChange={setActiveTab}
            timerRunning={timerState.isRunning && !timerState.isPaused}
          />
        </div>
      </div>
    </ToastProvider>
  );
}

export default App;