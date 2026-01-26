import { Meeting, User } from '../types';

const getLogoUrl = () => {
  const basePath = ((import.meta as any).env.BASE_URL || '/').replace(/\/$/, '');
  // Use logo.png from public folder
  return basePath ? `${basePath}/logo.png` : '/logo.png';
};

export const NotificationService = {
  // Check permission status
  getPermissionStatus: () => {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
  },

  // Request permission
  requestPermission: async () => {
    if (!('Notification' in window)) return false;
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  },

  // Send a system notification
  send: async (title: string, body: string, icon?: string) => {
    // Check if notifications are supported
    if (!('Notification' in window)) {
      console.warn('Notifications not supported in this browser');
      return;
    }

    // Request permission if not yet granted
    if (Notification.permission === 'default') {
      const granted = await NotificationService.requestPermission();
      if (!granted) return;
    }

    // SMART CHECK: If the user is actively looking at the app, don't show a system notification.
    if (document.visibilityState === 'visible') {
        console.log("App is focused. Suppressing system notification:", title);
        return;
    }

    if (Notification.permission === 'granted') {
      // Build options with browser-compatible features only
      const options: NotificationOptions = {
        body,
        icon: icon || getLogoUrl(),
        tag: 'tm-booker-notification', // Tag prevents stacking identical notifications
        requireInteraction: false // Changed to false for better compatibility
      };

      // Add vibrate only if supported (mobile browsers)
      if ('vibrate' in navigator) {
        (options as any).vibrate = [200, 100, 200];
      }

      // Add badge only if supported (some browsers don't support this)
      // Badge is optional and may cause errors in some browsers
      try {
        // Use Service Worker if available (Better for PWA/Background)
        if ('serviceWorker' in navigator) {
          try {
            // Wait for service worker to be ready with timeout
            const reg = await Promise.race([
              navigator.serviceWorker.ready,
              new Promise((_, reject) => setTimeout(() => reject(new Error('SW timeout')), 2000))
            ]) as ServiceWorkerRegistration;
            
            if (reg && reg.showNotification) {
              await reg.showNotification(title, options);
              console.log('✅ Notification sent via Service Worker:', title);
              return;
            }
          } catch (e) {
            console.warn("SW Notification failed, falling back to direct API:", e);
            // Continue to fallback
          }
        }

        // Fallback for standard web pages if SW fails or unavailable
        const notification = new Notification(title, options);
        console.log('✅ Notification sent directly:', title);
        
        // Auto-close after 5 seconds if user doesn't interact
        setTimeout(() => {
          notification.close();
        }, 5000);
      } catch (e) {
        console.error('❌ Notification failed:', e);
        // Don't throw - just log the error
      }
    }
  },

  // Test notification - for development/testing
  sendTest: async (customTitle?: string, customBody?: string) => {
    const title = customTitle || "🧪 Test Notification";
    const body = customBody || `This is a test notification sent at ${new Date().toLocaleTimeString()}`;
    
    console.log('Sending test notification...', { title, body });
    
    // Always send test notifications regardless of visibility
    if (!('Notification' in window)) {
      alert('Notifications not supported in this browser. Please use Chrome, Firefox, Edge, or Safari.');
      return;
    }

    // Request permission if not yet granted
    if (Notification.permission === 'default') {
      const granted = await NotificationService.requestPermission();
      if (!granted) {
        alert('Notification permission denied. Please enable notifications in your browser settings.');
        return;
      }
    }

    if (Notification.permission === 'granted') {
      const options: NotificationOptions = {
        body,
        icon: getLogoUrl(),
        tag: 'tm-test-notification',
        requireInteraction: false // Changed for better compatibility
      };

      // Add vibrate only if supported
      if ('vibrate' in navigator) {
        (options as any).vibrate = [200, 100, 200];
      }

      try {
        // Try Service Worker first with timeout
        if ('serviceWorker' in navigator) {
          try {
            const reg = await Promise.race([
              navigator.serviceWorker.ready,
              new Promise((_, reject) => setTimeout(() => reject(new Error('SW timeout')), 2000))
            ]) as ServiceWorkerRegistration;
            
            if (reg && reg.showNotification) {
              await reg.showNotification(title, options);
              console.log('✅ Test notification sent via SW');
              return;
            }
          } catch (e) {
            console.warn('SW not ready, using direct API:', e);
          }
        }
        
        // Fallback to direct Notification API
        const notification = new Notification(title, options);
        console.log('✅ Test notification sent directly');
        
        // Auto-close after 5 seconds
        setTimeout(() => {
          notification.close();
        }, 5000);
      } catch (e) {
        console.error('❌ Test notification failed:', e);
        const errorMsg = e instanceof Error ? e.message : String(e);
        alert(`Notification failed: ${errorMsg}. Please check your browser settings.`);
      }
    } else {
      alert('Notification permission not granted. Please enable notifications in your browser settings and refresh the page.');
    }
  },

  // Check for newly added meetings compared to local storage
  checkForNewMeetings: (meetings: Meeting[]) => {
    if (Notification.permission !== 'granted') return;

    const knownIdsStr = localStorage.getItem('known_meeting_ids');
    const currentIds = meetings.map(m => m.id);

    // First time logic: if no data, just save current state and exit to prevent spam
    if (!knownIdsStr) {
      localStorage.setItem('known_meeting_ids', JSON.stringify(currentIds));
      return;
    }

    const knownIds: string[] = JSON.parse(knownIdsStr);
    
    // Find meetings present now that weren't known before
    const newMeetings = meetings.filter(m => !knownIds.includes(m.id));

    if (newMeetings.length > 0) {
      const m = newMeetings[0];
      const count = newMeetings.length;
      
      const title = count === 1 ? "New Event Added! 📅" : `${count} New Events Added! 📅`;
      const body = count === 1 
        ? `${m.title} has been scheduled.`
        : `Check the agenda for ${count} new upcoming meetings.`;

      NotificationService.send(title, body);
    }
    
    // Always sync state
    localStorage.setItem('known_meeting_ids', JSON.stringify(currentIds));
  },

  // Main logic to check for reminders
  checkReminders: (user: User, meetings: Meeting[]) => {
    if (Notification.permission !== 'granted') return;

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Normalize dates to ignore time for comparison
    const isSameDay = (d1: Date, d2: Date) => 
      d1.getDate() === d2.getDate() && 
      d1.getMonth() === d2.getMonth() && 
      d1.getFullYear() === d2.getFullYear();

    meetings.forEach(meeting => {
      const meetingDate = new Date(meeting.date);

      // Check if meeting is tomorrow
      if (isSameDay(meetingDate, tomorrow)) {
        
        // 1. General Meeting Reminder
        // Key format: notified_meeting_[meetingID]
        const meetingKey = `notified_meeting_${meeting.id}`;
        if (!localStorage.getItem(meetingKey)) {
          NotificationService.send(
            "Meeting Tomorrow! 📅",
            `We have a meeting scheduled for tomorrow at ${meeting.time || 'usual time'}. Don't miss it!`
          );
          localStorage.setItem(meetingKey, 'true');
        }

        // Check for user roles in this meeting
        const userSlots = meeting.slots.filter(s => s.userId === user.id);

        userSlots.forEach(slot => {
          // Key format: notified_role_[slotID]
          const roleKey = `notified_role_${slot.id}`;
          
          if (!localStorage.getItem(roleKey)) {
            const isSpeaker = slot.roleName.toLowerCase().includes('speaker');

            if (isSpeaker) {
              // 3. Speaker specific message
              NotificationService.send(
                "Speech Jitters? 🦋",
                "Feeling nervous about your speech ah? Connect with your mentor for a quick run-through!"
              );
            } else {
              // 2. General Role message
              NotificationService.send(
                "Time to Shine! 🌟",
                `It is your time to shine as ${slot.roleName} tomorrow. You got this!`
              );
            }
            
            localStorage.setItem(roleKey, 'true');
          }
        });
      }
    });
  }
};