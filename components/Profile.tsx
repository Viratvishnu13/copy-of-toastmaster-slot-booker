import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';
import { dataService } from '../services/store';
import { NotificationService } from '../services/notificationService';
import { supabase } from '../services/supabaseClient';

// 🟢 CONFIG: Your Push Server URL (Hardcoded for reliability)
const PUSH_SERVER_URL = 'https://toastmaster-push-server.vercel.app';

interface ProfileProps {
  user: User;
  onUpdate: (user: User) => void;
  onLogout: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ user, onUpdate, onLogout }) => {
  // --- STATE ---
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(''); // General success/error messages
  
  // Notification State
  const [notifStatus, setNotifStatus] = useState<'granted' | 'denied' | 'default'>('default');
  const [pushStatus, setPushStatus] = useState<'active' | 'inactive' | 'loading'>('loading');
  
  // Admin Message State
  const [adminMsg, setAdminMsg] = useState({ title: '', body: '', sendToAll: true, targetIds: [] as string[] });
  const [sending, setSending] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  // Other
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- INITIALIZATION ---
  useEffect(() => {
    checkStatus();
    if (user.isAdmin) {
      dataService.getUsers().then(setAllUsers);
    }
  }, [user]);

  const checkStatus = async () => {
    // 1. Check Browser Permission
    const perm = NotificationService.getPermissionStatus();
    setNotifStatus(perm as any);

    // 2. Check Push Subscription (Only for Members)
    if (!user.isGuest && perm === 'granted') {
      try {
        const { PushService } = await import('../services/pushService');
        const sub = await PushService.getSubscription();
        setPushStatus(sub ? 'active' : 'inactive');
      } catch (e) {
        setPushStatus('inactive');
      }
    } else {
      setPushStatus('inactive');
    }
  };

  // --- ACTION: ENABLE NOTIFICATIONS (THE "ONE BUTTON") ---
  const handleEnableNotifications = async () => {
    setLoading(true);
    try {
      // Step 1: Request Browser Permission
      const granted = await NotificationService.requestPermission();
      setNotifStatus(granted ? 'granted' : 'denied');

      if (granted) {
        // Step 2: Subscribe to Push (If not guest)
        if (!user.isGuest) {
          const { PushService } = await import('../services/pushService');
          const sub = await PushService.subscribe(user.id);
          if (sub) {
            setPushStatus('active');
            setMessage("✅ Success! Notifications & Push Alerts enabled.");
            // Send a welcome ping
            await NotificationService.sendTest("You are connected! ⚡", "Push notifications are now active for this device.");
          } else {
             setMessage("⚠️ Browser permission granted, but Push failed. Check console.");
          }
        } else {
          setMessage("✅ Browser notifications enabled (Guest Mode).");
        }
      } else {
        alert("⚠️ Permission Denied. Please reset permissions in your browser settings (Lock icon).");
      }
    } catch (error) {
      console.error(error);
      setMessage("❌ Error enabling notifications.");
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 4000);
    }
  };

  // --- ACTION: SEND ANNOUNCEMENT (ADMIN) ---
  const handleSendAnnouncement = async () => {
    if (!adminMsg.title.trim() || !adminMsg.body.trim()) return alert("Please fill in Title and Message");
    if (!adminMsg.sendToAll && adminMsg.targetIds.length === 0) return alert("Select at least one user");

    setSending(true);
    try {
      // 1. Save to Database (History)
      const payload = {
        title: adminMsg.title,
        body: adminMsg.body,
        sent_by_user_id: user.id,
        target_user_id: adminMsg.sendToAll ? null : null, // Logic simplification: Bulk insert handles targets below
        created_at: new Date().toISOString()
      };

      // 2. Trigger Push Server
      const endpoint = adminMsg.sendToAll ? '/api/send-push-all' : '/api/send-push';
      
      if (adminMsg.sendToAll) {
         // DB Insert for Broadcast (target_user_id is null)
         await supabase.from('notifications').insert(payload);
         
         // Push Broadcast
         await fetch(`${PUSH_SERVER_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: adminMsg.title, body: adminMsg.body })
         });
      } else {
         // Specific Users
         for (const uid of adminMsg.targetIds) {
             // DB Insert per user
             await supabase.from('notifications').insert({ ...payload, target_user_id: uid });
             // Push per user
             await fetch(`${PUSH_SERVER_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: uid, title: adminMsg.title, body: adminMsg.body })
             });
         }
      }

      setMessage("🚀 Announcement Sent Successfully!");
      setAdminMsg({ title: '', body: '', sendToAll: true, targetIds: [] });
    } catch (e: any) {
      alert("Error sending: " + e.message);
    } finally {
      setSending(false);
      setTimeout(() => setMessage(''), 4000);
    }
  };

  // --- ACTION: CLEAR CACHE ---
  const handleClearCache = async () => {
    if (!confirm("This will refresh the app to fix any issues. Continue?")) return;
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(name => caches.delete(name)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    window.location.reload();
  };

  // --- ACTION: UPDATE PASSWORD ---
  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword || password.length < 6) return alert("Passwords must match and be 6+ chars");
    setLoading(true);
    const success = await dataService.updatePassword(password);
    setLoading(false);
    if (success) { setMessage("✅ Password updated!"); setPassword(''); setConfirmPassword(''); }
    else alert("Failed to update password.");
  };

  // --- ACTION: AVATAR UPLOAD ---
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(300 / img.width, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.7);
        
        const updated = await dataService.updateUser(user.id, { avatar: base64 });
        if (updated) { onUpdate(updated); setMessage("✅ Photo updated!"); }
        setLoading(false);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="pb-20 space-y-6 p-4">
      {/* 1. STATUS MESSAGE BAR */}
      {message && (
        <div className={`p-3 rounded-lg text-sm font-medium animate-pulse ${message.includes('Error') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
          {message}
        </div>
      )}

      {/* 2. PROFILE CARD */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col items-center text-center relative">
        <div className="relative group">
           <img src={user.avatar} alt="Profile" className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md" />
           {!user.isGuest && (
              <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full shadow hover:bg-blue-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              </button>
           )}
           <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} accept="image/*" className="hidden" />
        </div>
        <h2 className="mt-3 text-xl font-bold text-gray-900">{user.name}</h2>
        <p className="text-gray-500 text-sm">@{user.username}</p>
        
        {/* THE ONE "ENABLE NOTIFICATIONS" BUTTON */}
        <div className="mt-6 w-full">
          {(notifStatus === 'granted' && pushStatus === 'active') ? (
            <button disabled className="w-full py-2 bg-green-50 text-green-700 rounded-lg font-medium border border-green-200 flex items-center justify-center gap-2 cursor-default">
              <span>🔔 Notifications Active</span>
            </button>
          ) : (
            <button 
              onClick={handleEnableNotifications} 
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-semibold shadow-md hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {loading ? 'Enabling...' : '🔔 Enable Notifications'}
            </button>
          )}
          <p className="text-xs text-gray-400 mt-2">
            {pushStatus === 'active' ? 'You will receive alerts even when the app is closed.' : 'Tap to enable meeting reminders and alerts.'}
          </p>
        </div>
      </div>

      {/* 3. ADMIN ANNOUNCEMENT PANEL */}
      {user.isAdmin && (
        <div className="bg-white rounded-xl shadow-sm border border-indigo-100 overflow-hidden">
          <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100">
            <h3 className="font-bold text-indigo-900 flex items-center gap-2">
              📢 Admin Announcement
            </h3>
          </div>
          <div className="p-4 space-y-3">
            <input 
              type="text" 
              placeholder="Announcement Title" 
              className="w-full p-2 border rounded-lg text-sm font-semibold"
              value={adminMsg.title}
              onChange={e => setAdminMsg({...adminMsg, title: e.target.value})}
            />
            <textarea 
              placeholder="Write your message here..." 
              className="w-full p-2 border rounded-lg text-sm h-20 resize-none"
              value={adminMsg.body}
              onChange={e => setAdminMsg({...adminMsg, body: e.target.value})}
            />
            
            {/* --- 🔴 RESTORED: User Selection List --- */}
            {!adminMsg.sendToAll && (
              <div className="max-h-40 overflow-y-auto border rounded-lg bg-gray-50 p-2 space-y-1 mb-2">
                <p className="text-xs font-bold text-gray-500 mb-1 sticky top-0 bg-gray-50">Select Recipients:</p>
                {allUsers.filter(u => !u.isGuest && u.id !== user.id).map(u => (
                  <label key={u.id} className="flex items-center p-2 hover:bg-white rounded cursor-pointer border border-transparent hover:border-gray-200 transition-colors">
                    <input 
                      type="checkbox"
                      checked={adminMsg.targetIds.includes(u.id)}
                      onChange={e => {
                        const newIds = e.target.checked 
                          ? [...adminMsg.targetIds, u.id] 
                          : adminMsg.targetIds.filter(id => id !== u.id);
                        setAdminMsg({...adminMsg, targetIds: newIds});
                      }}
                      className="mr-3 h-4 w-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-800">{u.name}</span>
                      <span className="text-xs text-gray-400">{u.email}</span>
                    </div>
                  </label>
                ))}
                {allUsers.filter(u => !u.isGuest && u.id !== user.id).length === 0 && (
                   <p className="text-xs text-gray-400 text-center py-2">No other members found.</p>
                )}
              </div>
            )}
            
            <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-2">
              <label className="flex items-center text-sm text-gray-600 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={adminMsg.sendToAll} 
                  onChange={e => setAdminMsg({...adminMsg, sendToAll: e.target.checked})}
                  className="mr-2 h-4 w-4 text-indigo-600 rounded" 
                />
                <span className={adminMsg.sendToAll ? "font-bold text-indigo-600" : ""}>
                  Send to Everyone
                </span>
              </label>
              <button 
                onClick={handleSendAnnouncement}
                disabled={sending}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                {sending ? 'Sending...' : 'Send Now 🚀'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. SETTINGS GRID */}
      <div className="grid grid-cols-1 gap-4">
        {/* Password */}
        {!user.isGuest && (
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <h4 className="font-semibold text-gray-700 mb-3 text-sm">Change Password</h4>
            <form onSubmit={handlePasswordUpdate} className="flex flex-col gap-2">
              <input type="password" placeholder="New Password" value={password} onChange={e => setPassword(e.target.value)} className="p-2 border rounded-lg text-sm" />
              <input type="password" placeholder="Confirm Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="p-2 border rounded-lg text-sm" />
              <button type="submit" disabled={loading} className="py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-black">Update Password</button>
            </form>
          </div>
        )}

        {/* Clear Cache */}
        <button 
          onClick={handleClearCache}
          className="bg-orange-50 text-orange-700 py-3 rounded-xl font-medium border border-orange-200 hover:bg-orange-100 transition flex items-center justify-center gap-2"
        >
          <span>🔄 Refresh App / Clear Cache</span>
        </button>

        {/* Logout */}
        <button 
          onClick={onLogout}
          className="bg-red-50 text-red-600 py-3 rounded-xl font-bold border border-red-100 hover:bg-red-100 transition"
        >
          {user.isGuest ? 'Exit Guest Mode' : 'Log Out'}
        </button>
      </div>

      <div className="text-center text-xs text-gray-300 pt-4">
        Toastmaster Slot Booker
        <br></br>
        Powered by HCL Pandyas
      </div>
    </div>
  );
};
