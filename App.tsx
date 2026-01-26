import React, { useState, useEffect } from 'react';
import { Auth } from './components/Auth';
import { Agenda } from './components/Agenda';
import { CalendarView } from './components/CalendarView';
import { Profile } from './components/Profile';
import { User, NotificationLog } from './types';
import { dataService } from './services/store';
import { NotificationService } from './services/notificationService';
import { supabase } from './services/supabaseClient';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentTab, setCurrentTab] = useState<'agenda' | 'calendar' | 'profile'>('agenda');
  const [loadingSession, setLoadingSession] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  // Restore Session on Mount
  useEffect(() => {
    const restoreSession = async () => {
      const storedUser = await dataService.getCurrentSession();
      if (storedUser) {
        setUser(storedUser);
        // Register device with restored user
        if (!storedUser.isGuest) {
          const { DeviceService } = await import('./services/deviceService');
          DeviceService.registerDevice(storedUser.id);
        }
      } else {
        // Register device as guest/unregistered
        const { DeviceService } = await import('./services/deviceService');
        DeviceService.registerDevice(null);
      }
      setLoadingSession(false);
    };
    restoreSession();
  }, []);

  // PWA Install Prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    if (choiceResult.outcome === 'accepted') {
      console.log('User accepted PWA installation');
    }
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  // Trigger Notification Check when User logs in & Setup Realtime Listener
  useEffect(() => {
    let meetingsChannel: any;
    let notificationChannel: any;

    const runChecks = async () => {
      if (user) {
        // 1. Initial Checks for Local Reminders (for all users including guests)
        const meetings = await dataService.getMeetings();
        NotificationService.checkForNewMeetings(meetings);
        
        // Only check role reminders for non-guest users (guests don't have roles)
        if (!user.isGuest) {
          NotificationService.checkReminders(user, meetings);
        }

        // 2. Realtime Subscription for Meetings (New Events) - All users can receive
        meetingsChannel = supabase.channel('public:meetings')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'meetings' }, payload => {
            const newMeeting = payload.new as any;
            NotificationService.send("New Event Added! 📅", `${newMeeting.title} has been scheduled.`);
          })
          .subscribe();

        // 3. Realtime Subscription for Custom Admin Notifications
        // Guests can receive broadcast notifications (target_user_id === null)
        notificationChannel = supabase.channel('public:notifications')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
             const notif = payload.new as NotificationLog;
             // Check if notification is for everyone (null) or specifically for this user
             // Guests can only receive broadcast notifications (null target)
             if (notif.target_user_id === null || (!user.isGuest && notif.target_user_id === user.id)) {
                 NotificationService.send(notif.title, notif.body);
             }
          })
          .subscribe();
      }
    };

    runChecks();

    return () => {
      if (meetingsChannel) supabase.removeChannel(meetingsChannel);
      if (notificationChannel) supabase.removeChannel(notificationChannel);
    };
  }, [user]);

  const handleLogin = async (loggedInUser: User) => {
    setUser(loggedInUser);
    // Register device with logged-in user
    if (!loggedInUser.isGuest) {
      const { DeviceService } = await import('./services/deviceService');
      DeviceService.registerDevice(loggedInUser.id);
    }
  };

  const handleLogout = async () => {
    // Clear device registration
    if (user && !user.isGuest) {
      const { DeviceService } = await import('./services/deviceService');
      await DeviceService.clearDevice();
    }
    await dataService.logout();
    setUser(null);
  };

  const handleUpdateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  if (loadingSession) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>;
  }

  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className="relative min-h-screen bg-gray-50 max-w-lg mx-auto shadow-2xl">
      {/* Install Prompt Banner */}
      {showInstallPrompt && (
        <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between z-50 fixed top-0 left-0 right-0 max-w-lg mx-auto shadow-lg">
          <span className="text-sm font-semibold">Install Toastmasters Booker app?</span>
          <div className="flex gap-2">
            <button
              onClick={handleInstallApp}
              className="bg-white text-blue-600 px-3 py-1 rounded text-sm font-semibold hover:bg-gray-100"
            >
              Install
            </button>
            <button
              onClick={() => setShowInstallPrompt(false)}
              className="text-blue-100 hover:text-white text-sm"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Content - Scrollable with padding for fixed footer and optional banner */}
      <div className={`pb-24 overflow-y-auto ${showInstallPrompt ? 'pt-16' : ''}`}>
        {currentTab === 'agenda' && <Agenda currentUser={user} />}
        {currentTab === 'calendar' && <CalendarView currentUser={user} />}
        {currentTab === 'profile' && <Profile user={user} onUpdate={handleUpdateUser} onLogout={handleLogout} />}
      </div>

      {/* Bottom Navigation - Fixed Footer */}
      <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white border-t border-gray-200 flex justify-around items-center h-20 z-50 shadow-2xl">
        <button 
          onClick={() => setCurrentTab('agenda')}
          className={`flex flex-col items-center justify-center w-full h-full space-y-1.5 transition-colors ${currentTab === 'agenda' ? 'text-blue-900 bg-blue-50' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span className="text-xs font-bold">Agenda</span>
        </button>

        <button 
          onClick={() => setCurrentTab('calendar')}
          className={`flex flex-col items-center justify-center w-full h-full space-y-1.5 transition-colors ${currentTab === 'calendar' ? 'text-blue-900 bg-blue-50' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-xs font-bold">Events</span>
        </button>

        <button 
          onClick={() => setCurrentTab('profile')}
          className={`flex flex-col items-center justify-center w-full h-full space-y-1.5 transition-colors ${currentTab === 'profile' ? 'text-blue-900 bg-blue-50' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-xs font-bold">Profile</span>
        </button>
      </div>
    </div>
  );
}

export default App;
