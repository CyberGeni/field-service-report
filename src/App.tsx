import { useState, useEffect } from 'react';
import Navigation from './components/Navigation';
import LogTab from './components/LogTab';
import HomeTab from './components/HomeTab';
import CalendarTab from './components/CalendarTab';
import PeopleTab from './components/PeopleTab';
import StatsPage from './components/StatsPage';
import ErrorBoundary from './components/ErrorBoundary';
import SettingsTab from './components/SettingsTab';
import MonthlyReportPrompt from './components/MonthlyReportPrompt';
import SyncStatusBanner from './components/SyncStatusBanner';
import SplashScreen from './components/auth/SplashScreen';
import SignInForm from './components/auth/SignInForm';
import SignUpForm from './components/auth/SignUpForm';
import ForgotPasswordForm from './components/auth/ForgotPasswordForm';
import ProfileSetup from './components/ProfileSetup';
import { useStorage } from './hooks/useStorage';
import { getPendingReportMonth, useReportSubmissions } from './hooks/useReportSubmissions';
import { useTimer } from './hooks/useTimer';
import { useAuth } from './hooks/useAuth';
import { useProfile } from './hooks/useProfile';
import { hasHourRequirement } from './utils/serviceTypes';

type AuthView = 'splash' | 'signin' | 'signup' | 'forgot-password';

function App() {
  const [activeTab, setActiveTab] = useState('home');
  // A person tapped somewhere else (today's visit list) to open on the People tab
  const [openPersonId, setOpenPersonId] = useState<string | null>(null);
  const [authView, setAuthView] = useState<AuthView>('splash');
  // Dismissing only quiets the report prompt for this visit - it is deliberately not
  // persisted, so an unsent report is waiting again next time the app opens.
  const [reportPromptDismissed, setReportPromptDismissed] = useState(false);
  const {
    records,
    settings,
    loading: storageLoading,
    online,
    syncing,
    pendingChanges,
    saveRecord,
    deleteRecord,
    updateSettings
  } = useStorage();
  const { timerState, startTimer, pauseTimer, stopTimer, setServiceType } = useTimer();
  const { user, loading: authLoading, signIn, signUp, signOut, resetPassword } = useAuth();
  const { profile, loading: profileLoading, createProfile, updateProfile, uploadAvatar, getDefaultTargets } = useProfile(user);
  const { isSubmitted, markSubmitted, getCarryoverInto, trackingStartMonth } =
    useReportSubmissions(user?.id);

  const pendingReportMonth = getPendingReportMonth(records, isSubmitted, trackingStartMonth);

  // Register service worker for PWA (production only). In dev the SW would
  // cache Vite's source modules and serve a stale, half-broken module graph,
  // so instead we tear down any SW/caches a previous build left behind.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('SW registered: ', registration);
        })
        .catch(registrationError => {
          console.log('SW registration failed: ', registrationError);
        });
      return;
    }

    navigator.serviceWorker.getRegistrations()
      .then(registrations => Promise.all(registrations.map(r => r.unregister())))
      .then(() => (typeof caches !== 'undefined' ? caches.keys() : []))
      .then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .catch(err => console.warn('SW cleanup failed:', err));
  }, []);

  // Update settings when profile changes (only for service types with requirements)
  useEffect(() => {
    // Never before the user's own settings have loaded: applying a service type's
    // default targets to the placeholder settings would write the default field
    // service days over whatever they had actually saved.
    if (storageLoading) return;

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
  }, [profile?.service_type, storageLoading]);

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
      is_volunteer: boolean;
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
  const openPerson = (personId: string) => {
    setOpenPersonId(personId);
    setActiveTab('students');
  };
  const clearOpenPerson = () => setOpenPersonId(null);

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'log':
        return (
          <LogTab 
            records={records} 
            settings={settings} 
            profile={profile}
            onSaveRecord={saveRecord}
            timerState={timerState}
            onStartTimer={startTimer}
            onPauseTimer={pauseTimer}
            onStopTimer={stopTimer}
            onSetServiceType={setServiceType}
          />
        );
      case 'home':
        return <HomeTab records={records} settings={settings} profile={profile} onOpenPerson={openPerson} onUpdateSettings={updateSettings} />;
      case 'calendar':
        return <CalendarTab records={records} settings={settings} profile={profile} onSaveRecord={saveRecord} onDeleteRecord={deleteRecord} onUpdateSettings={updateSettings} />;
      case 'stats':
        return <StatsPage records={records} profile={profile} userId={user?.id} />;
      case 'students':
        return <PeopleTab openPersonId={openPersonId} onOpenPersonHandled={clearOpenPerson} />;
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
        return <HomeTab records={records} settings={settings} profile={profile} onOpenPerson={openPerson} onUpdateSettings={updateSettings} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-gray-100 pb-20">
      <div className="max-w-md mx-auto">
        {/* Main Content */}
        <main className="p-6 pt-8">
          <SyncStatusBanner online={online} syncing={syncing} pendingChanges={pendingChanges} />

          {/* Keyed by tab so switching away from a broken screen clears the error */}
          <ErrorBoundary key={activeTab} onReset={() => setActiveTab('home')}>
            {renderActiveTab()}
          </ErrorBoundary>
        </main>

        {/* Last month's report still needs sending */}
        {pendingReportMonth && !reportPromptDismissed && (
          <MonthlyReportPrompt
            monthKey={pendingReportMonth}
            records={records}
            carriedInMinutes={getCarryoverInto(pendingReportMonth)}
            onCopied={markSubmitted}
            onDismiss={() => setReportPromptDismissed(true)}
          />
        )}

        {/* Navigation with timer indicator */}
        <Navigation 
          activeTab={activeTab} 
          onTabChange={setActiveTab}
          timerRunning={timerState.isRunning && !timerState.isPaused}
        />
      </div>
    </div>
  );
}

export default App;