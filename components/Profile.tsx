import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';
import { dataService } from '../services/store';
import { NotificationService } from '../services/notificationService';
import { supabase } from '../services/supabaseClient';

interface ProfileProps {
  user: User;
  onUpdate: (user: User) => void;
  onLogout: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ user, onUpdate, onLogout }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState(NotificationService.getPermissionStatus());
  const [allUsers, setAllUsers] = useState<User[]>([]); // For Admin Directory
  
  // Notification Center State
  const [customMessage, setCustomMessage] = useState({
    title: '',
    body: '',
    sendToAll: true,
    targetUserIds: [] // Changed to support multiple users
  });
  const [sendingNotif, setSendingNotif] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [clearingCache, setClearingCache] = useState(false);
  const [pushStatus, setPushStatus] = useState<'subscribed' | 'not-subscribed' | 'unsupported' | 'checking'>('checking');
  const [subscribingPush, setSubscribingPush] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPermissionStatus(NotificationService.getPermissionStatus());
    
    // Fetch all users for the directory/targeting
    if (user.isAdmin) {
        dataService.getUsers().then(setAllUsers);
    } else {
        dataService.getUsers().then(setAllUsers);
    }

    // Check push subscription status
    const checkPushStatus = async () => {
      if (!user.isGuest) {
        const { PushService } = await import('../services/pushService');
        const status = await PushService.getSubscriptionStatus();
        setPushStatus(status);
      } else {
        setPushStatus('unsupported');
      }
    };
    checkPushStatus();
  }, [user.isAdmin, user.isGuest]);

  const handleRequestPermission = async () => {
    const granted = await NotificationService.requestPermission();
    setPermissionStatus(granted ? 'granted' : 'denied');
    if (granted) {
      setSuccessMessage('Notification permission granted!');
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  const handleSendTest = async () => {
    if (permissionStatus !== 'granted') {
      alert('Please enable notifications first');
      return;
    }
    setSendingNotif(true);
    await NotificationService.sendTest(
      customMessage.title || undefined,
      customMessage.body || undefined
    );
    setSendingNotif(false);
    setSuccessMessage('Test notification sent!');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleClearCache = async () => {
    if (!window.confirm('Clear all cached data? This will force a fresh reload of the app.')) {
      return;
    }
    
    setClearingCache(true);
    try {
      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('✅ All caches cleared');
      }
      
      // Unregister service worker
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
        console.log('✅ Service workers unregistered');
      }
      
      // Clear localStorage (optional - be careful with this)
      // localStorage.clear();
      
      setSuccessMessage('Cache cleared! Refreshing page...');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error clearing cache:', error);
      setSuccessMessage('Error clearing cache. Please try manually in browser settings.');
      setClearingCache(false);
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  const handleSendCustom = async () => {
    if (!customMessage.title.trim()) {
      alert('Please enter a title');
      return;
    }
    
    if (!customMessage.body.trim()) {
      alert('Please enter a message body');
      return;
    }

    if (!customMessage.sendToAll && customMessage.targetUserIds.length === 0) {
      alert('Please select at least one user or check "Send to All Users"');
      return;
    }

    if (permissionStatus !== 'granted') {
      alert('Notifications not enabled');
      return;
    }

      setSendingNotif(true);

    try {
      // Send notification to database
      if (customMessage.sendToAll) {
        // Send to all users (target_user_id = null)
        const { error } = await supabase
          .from('notifications')
          .insert({
            title: customMessage.title,
            body: customMessage.body,
            sent_by_user_id: user.id,
            target_user_id: null,
            created_at: new Date().toISOString()
          });

        if (error) throw error;
        
        // Also send push notifications if server is configured
        const pushServerUrl = import.meta.env.VITE_PUSH_SERVER_URL || '';
        if (pushServerUrl) {
          try {
            await fetch(`${pushServerUrl}/api/send-push-all`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: customMessage.title,
                body: customMessage.body
              })
            });
          } catch (pushError) {
            console.warn('Push notification server not available:', pushError);
            // Continue even if push fails
          }
        }
        
        await NotificationService.sendTest(customMessage.title, customMessage.body);
      } else {
        // Send to selected users (one record per user)
        for (const targetUserId of customMessage.targetUserIds) {
          const { error } = await supabase
            .from('notifications')
            .insert({
              title: customMessage.title,
              body: customMessage.body,
              sent_by_user_id: user.id,
              target_user_id: targetUserId,
              created_at: new Date().toISOString()
            });

          if (error) throw error;
          
          // Send push notification if server is configured
          const pushServerUrl = import.meta.env.VITE_PUSH_SERVER_URL || '';
          if (pushServerUrl) {
            try {
              await fetch(`${pushServerUrl}/api/send-push`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userId: targetUserId,
                  title: customMessage.title,
                  body: customMessage.body
                })
              });
            } catch (pushError) {
              console.warn('Push notification server not available:', pushError);
            }
          }
          
          // Send to self if user is in the selected list
          if (targetUserId === user.id) {
            await NotificationService.sendTest(customMessage.title, customMessage.body);
          }
        }
      }

      setSuccessMessage('Notification sent successfully!');
      setCustomMessage({ title: '', body: '', sendToAll: true, targetUserIds: [] });
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error sending notification:', error);
      alert(`Error sending notification: ${String(error)}`);
    } finally {
      setSendingNotif(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setMessage('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setMessage('Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    // This updates the actual Auth password for the logged-in user
    const success = await dataService.updatePassword(password);
    setLoading(false);

    if (success) {
      setMessage('Success! Your login password has been updated.');
      setPassword('');
      setConfirmPassword('');
    } else {
      setMessage('Failed to update password. Try again.');
    }
  };

  // Logic to resize image and convert to Base64
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);

    try {
      const base64Image = await resizeAndConvertToBase64(file);
      const updated = await dataService.updateUser(user.id, { avatar: base64Image });
      if (updated) {
        onUpdate(updated);
        setMessage('Profile photo updated successfully!');
      }
    } catch (err) {
      console.error(err);
      setMessage('Error uploading image. Please try a smaller file.');
    } finally {
      setLoading(false);
    }
  };

  const resizeAndConvertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 300; // Limit width to save DB space
          const scaleSize = MAX_WIDTH / img.width;
          
          // Only resize if bigger than MAX_WIDTH
          if (scaleSize < 1) {
              canvas.width = MAX_WIDTH;
              canvas.height = img.height * scaleSize;
          } else {
              canvas.width = img.width;
              canvas.height = img.height;
          }

          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // Compress to JPEG with 0.7 quality
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = reject;
        img.src = event.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="pb-4">
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <h2 className="text-xl font-bold text-gray-800">My Profile</h2>
      </div>

      <div className="p-4 space-y-6">
        {/* Header Profile Card */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col items-center text-center">
          <div className="relative group">
             <img src={user.avatar} alt="Profile" className="w-24 h-24 rounded-full object-cover border-4 border-indigo-50 shadow-sm" />
             {!user.isGuest && (
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 bg-blue-900 text-white p-1.5 rounded-full border-2 border-white hover:bg-blue-700 transition"
                  title="Upload Photo"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
             )}
          </div>
          <h3 className="mt-4 text-xl font-bold text-gray-900">{user.name}</h3>
          
          <div className="flex flex-col items-center mt-1">
            {user.email && (
                <p className="text-sm text-gray-600 font-medium">{user.email}</p>
            )}
            <p className="text-xs text-gray-400">@{user.username}</p>
          </div>
          
          {user.isAdmin && <span className="mt-2 text-xs font-bold text-blue-900 bg-blue-100 px-3 py-1 rounded-full">Administrator</span>}
          {user.isGuest && <span className="mt-2 text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full">Guest Account</span>}
        </div>

        {/* Notification Center */}
        {user.isAdmin && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-blue-100 ring-1 ring-blue-100">
             <h4 className="text-sm font-semibold text-blue-900 mb-4 uppercase tracking-wider flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                </svg>
                Notification Center
             </h4>

             {/* Permission Status */}
             <div className="mb-4 p-3 rounded-lg bg-gray-100">
                <div className="text-sm text-gray-600 mb-2">
                   <strong>Status:</strong> <span className="capitalize font-semibold">{permissionStatus}</span>
                </div>
                {permissionStatus !== 'granted' && (
                   <button
                     onClick={handleRequestPermission}
                     className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium text-sm"
                   >
                     Enable Notifications
                   </button>
                )}
             </div>

             {successMessage && (
               <div className="mb-4 p-3 rounded-lg bg-green-100 text-green-800 text-sm">
                 ✓ {successMessage}
               </div>
             )}

             {/* Send Custom Message */}
             <div>
                <h5 className="font-semibold text-gray-900 mb-2 text-sm">Send Custom Message</h5>
                
                <div className="mb-3">
                   <label className="flex items-center text-sm text-gray-700 mb-3">
                     <input
                       type="checkbox"
                       checked={customMessage.sendToAll}
                       onChange={(e) => setCustomMessage({
                         ...customMessage,
                         sendToAll: e.target.checked,
                         targetUserIds: e.target.checked ? [] : customMessage.targetUserIds
                       })}
                       className="mr-2 w-4 h-4"
                     />
                     Send to All Users
                   </label>
                   
                   {!customMessage.sendToAll && (
                     <div className="space-y-2 mb-3">
                       <p className="text-xs text-gray-600 font-semibold">Select one or more users:</p>
                       <div className="grid grid-cols-1 max-h-48 overflow-y-auto border border-gray-300 rounded-lg bg-gray-50">
                         {allUsers.filter(u => !u.isGuest).map(u => (
                           <label key={u.id} className="flex items-center px-3 py-2 hover:bg-gray-100 border-b border-gray-200 last:border-b-0 cursor-pointer">
                             <input
                               type="checkbox"
                               checked={customMessage.targetUserIds.includes(u.id)}
                               onChange={(e) => {
                                 const newIds = e.target.checked
                                   ? [...customMessage.targetUserIds, u.id]
                                   : customMessage.targetUserIds.filter(id => id !== u.id);
                                 setCustomMessage({ ...customMessage, targetUserIds: newIds });
                               }}
                               className="mr-2 w-4 h-4 cursor-pointer"
                             />
                             <span className="text-sm text-gray-700">{u.name}</span>
                           </label>
                         ))}
                       </div>
                       {customMessage.targetUserIds.length > 0 && (
                         <p className="text-xs text-blue-600 font-medium">✓ {customMessage.targetUserIds.length} user(s) selected</p>
                       )}
                     </div>
                   )}
                </div>

                <input
                   type="text"
                   placeholder="Title"
                   value={customMessage.title}
                   onChange={(e) => setCustomMessage({ ...customMessage, title: e.target.value })}
                   className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2"
                />
                <textarea
                   placeholder="Message body"
                   value={customMessage.body}
                   onChange={(e) => setCustomMessage({ ...customMessage, body: e.target.value })}
                   className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none h-16 mb-3"
                />
                
                <button
                   onClick={handleSendCustom}
                   disabled={sendingNotif || permissionStatus !== 'granted'}
                   className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                >
                   {sendingNotif ? 'Sending...' : '📤 Send Message'}
                </button>
             </div>
          </div>
        )}

        {/* Notification Settings - For All Users (Members & Guests) */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h4 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wider flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
            </svg>
            Notification Settings
          </h4>

          {/* Permission Status */}
          <div className="mb-4 p-3 rounded-lg bg-gray-100">
            <div className="text-sm text-gray-600 mb-2">
              <strong>Status:</strong> <span className="capitalize font-semibold">{permissionStatus}</span>
            </div>
            {permissionStatus === 'unsupported' && (
              <p className="text-xs text-red-600 mt-2">
                Your browser does not support notifications. Please use a modern browser like Chrome, Firefox, or Edge.
              </p>
            )}
            {permissionStatus === 'denied' && (
              <div className="mt-2">
                <p className="text-xs text-red-600 mb-2">
                  Notifications are blocked. To enable:
                </p>
                <ol className="text-xs text-gray-600 list-decimal list-inside space-y-1">
                  <li>Click the lock icon in your browser's address bar</li>
                  <li>Find "Notifications" and change it to "Allow"</li>
                  <li>Refresh this page</li>
                </ol>
              </div>
            )}
            {permissionStatus === 'default' && (
              <button
                onClick={handleRequestPermission}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium text-sm mt-2"
              >
                Enable Notifications
              </button>
            )}
            {permissionStatus === 'granted' && (
              <div className="mt-2">
                <p className="text-xs text-green-700 font-medium">✓ Notifications are enabled!</p>
              </div>
            )}
          </div>

          {successMessage && (
            <div className="mb-4 p-3 rounded-lg bg-green-100 text-green-800 text-sm">
              ✓ {successMessage}
            </div>
          )}

          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <p className="text-sm text-blue-900 mb-3">
              <strong>💡 Tip:</strong> Notifications will appear when you minimize the app or switch tabs. You'll receive reminders for meetings, your assigned roles, and announcements from admins.
            </p>
            
            {/* Notification Behavior Setting */}
            <div className="mt-3 pt-3 border-t border-blue-200">
              <label className="flex items-center text-sm text-blue-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localStorage.getItem('notifications_suppress_when_visible') !== 'false'}
                  onChange={(e) => {
                    localStorage.setItem('notifications_suppress_when_visible', e.target.checked ? 'true' : 'false');
                    setSuccessMessage(e.target.checked 
                      ? 'Notifications will be hidden when app is open'
                      : 'Notifications will show even when app is open');
                    setTimeout(() => setSuccessMessage(''), 3000);
                  }}
                  className="mr-2 w-4 h-4"
                />
                <span>Hide notifications when app is open (recommended)</span>
              </label>
              <p className="text-xs text-blue-700 mt-1 ml-6">
                Uncheck to receive notifications even when viewing the app
              </p>
            </div>
            
            {/* Push Notifications (Background) */}
            {!user.isGuest && (
              <div className="mt-3 pt-3 border-t border-blue-200">
                <h5 className="text-xs font-semibold text-blue-900 mb-2 uppercase tracking-wider">Background Push Notifications</h5>
                <p className="text-xs text-blue-700 mb-3">
                  Enable push notifications to receive alerts even when the browser is closed (requires PWA installation).
                </p>
                
                {pushStatus === 'checking' && (
                  <p className="text-xs text-blue-600">Checking status...</p>
                )}
                
                {pushStatus === 'unsupported' && (
                  <p className="text-xs text-orange-600">
                    Push notifications are not supported in this browser. Please use Chrome, Firefox, or Edge.
                  </p>
                )}
                
                {pushStatus === 'not-subscribed' && (
                  <button
                    onClick={async () => {
                      setSubscribingPush(true);
                      try {
                        const { PushService } = await import('../services/pushService');
                        const subscription = await PushService.subscribe(user.id);
                        if (subscription) {
                          setPushStatus('subscribed');
                          setSuccessMessage('Push notifications enabled! You\'ll receive notifications even when the browser is closed.');
                          setTimeout(() => setSuccessMessage(''), 5000);
                        } else {
                          setSuccessMessage('Failed to enable push notifications. Please check browser permissions.');
                          setTimeout(() => setSuccessMessage(''), 3000);
                        }
                      } catch (error) {
                        console.error('Push subscription error:', error);
                        setSuccessMessage('Error enabling push notifications.');
                        setTimeout(() => setSuccessMessage(''), 3000);
                      } finally {
                        setSubscribingPush(false);
                      }
                    }}
                    disabled={subscribingPush || permissionStatus !== 'granted'}
                    className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                  >
                    {subscribingPush ? 'Enabling...' : '🔔 Enable Push Notifications'}
                  </button>
                )}
                
                {pushStatus === 'subscribed' && (
                  <div>
                    <p className="text-xs text-green-700 font-medium mb-2">✓ Push notifications are enabled!</p>
                    <button
                      onClick={async () => {
                        setSubscribingPush(true);
                        try {
                          const { PushService } = await import('../services/pushService');
                          const unsubscribed = await PushService.unsubscribe();
                          if (unsubscribed) {
                            setPushStatus('not-subscribed');
                            setSuccessMessage('Push notifications disabled.');
                            setTimeout(() => setSuccessMessage(''), 3000);
                          }
                        } catch (error) {
                          console.error('Push unsubscribe error:', error);
                          setSuccessMessage('Error disabling push notifications.');
                          setTimeout(() => setSuccessMessage(''), 3000);
                        } finally {
                          setSubscribingPush(false);
                        }
                      }}
                      disabled={subscribingPush}
                      className="w-full bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                    >
                      {subscribingPush ? 'Disabling...' : 'Disable Push Notifications'}
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {/* Background Notifications Info */}
            <div className="mt-3 pt-3 border-t border-blue-200">
              <p className="text-xs text-blue-800">
                <strong>📱 Note:</strong> Regular notifications work when the browser is minimized. Push notifications (above) work even when the browser is completely closed, but require the app to be installed as a PWA.
              </p>
            </div>
          </div>

          {/* Cache Management */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h5 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wider">Cache Management</h5>
            <p className="text-xs text-gray-600 mb-3">
              If you're seeing old content or having issues, clear the cache to force a fresh reload.
            </p>
            <button
              onClick={handleClearCache}
              disabled={clearingCache}
              className="w-full bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
            >
              {clearingCache ? 'Clearing...' : '🗑️ Clear Cache & Reload'}
            </button>
          </div>
        </div>

        {/* Notification Settings Summary - Admin Only */}
        {user.isAdmin && (
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
             <p className="text-sm text-blue-900">
                <strong>💡 Admin Tip:</strong> Use the Notification Center above to send custom messages to all users or specific members.
             </p>
          </div>
        )}

        {/* Avatar Settings - Only for Registered Users */}
        {!user.isGuest && (
            <div className={`bg-white rounded-xl p-6 shadow-sm border border-gray-100 transition-opacity ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">Change Profile Photo</h4>
              
              <div className="space-y-3">
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden" 
                  />
                  
                  <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50 hover:border-gray-400 transition"
                  >
                      <svg className="mx-auto h-8 w-8 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <p className="mt-1 text-sm text-gray-600 font-medium">Click to upload from device</p>
                      <p className="text-xs text-gray-500">JPG, PNG, GIF</p>
                  </div>
                  
                  {loading && <p className="text-center text-xs text-blue-600 animate-pulse">Processing image...</p>}
              </div>
            </div>
        )}

        {/* Change Password */}
        {!user.isGuest && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h4 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wider">Change Password</h4>
              <p className="text-xs text-gray-500 mb-4">
                Update your login credentials directly below.
              </p>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">New Password</label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Confirm Password</label>
                  <input 
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                  />
                </div>
                {message && <p className={`text-sm ${message.includes('Success') || message.includes('Avatar') || message.includes('updated') ? 'text-green-600' : 'text-red-500'}`}>{message}</p>}
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-gray-900 text-white py-2 rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </div>
        )}

        {/* Admin Directory */}
        {user.isAdmin && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h4 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wider flex items-center justify-between">
                    <span>Club Directory (Admin)</span>
                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">{allUsers.length} Users</span>
                </h4>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    {allUsers.map(u => (
                        <div key={u.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-100 transition">
                            <img src={u.avatar} alt="" className="w-8 h-8 rounded-full bg-gray-200" />
                            <div className="overflow-hidden">
                                <p className="text-sm font-bold text-gray-900 truncate">{u.name}</p>
                                <p className="text-xs text-blue-600 truncate select-all">{u.email}</p>
                            </div>
                            {u.isAdmin && <span className="ml-auto text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Admin</span>}
                        </div>
                    ))}
                </div>
                <div className="mt-3 p-3 bg-yellow-50 rounded-lg text-xs text-yellow-800 border border-yellow-100">
                    <strong>Tip:</strong> Copy an email above and use it in the Supabase SQL Editor to manually reset a password if a user forgets it.
                </div>
            </div>
        )}

        <button 
          onClick={onLogout}
          className="w-full bg-red-50 text-red-600 py-3 rounded-xl font-semibold hover:bg-red-100 transition"
        >
          {user.isGuest ? 'Exit Guest Mode (Login)' : 'Logout'}
        </button>
      </div>
    </div>
  );
};