import React, { useState } from 'react';
import { NotificationService } from '../services/notificationService';
import { dataService } from '../services/store';
import { supabase } from '../services/supabaseClient';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ 
  isOpen, 
  onClose, 
  currentUserId 
}) => {
  const [permissionStatus, setPermissionStatus] = useState(NotificationService.getPermissionStatus());
  const [customMessage, setCustomMessage] = useState({
    title: '',
    body: '',
    sendToAll: true,
    targetUserId: ''
  });
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [showUserSelect, setShowUserSelect] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setPermissionStatus(NotificationService.getPermissionStatus());
      loadUsers();
    }
  }, [isOpen]);

  const loadUsers = async () => {
    const allUsers = await dataService.getUsers();
    setUsers(allUsers || []);
  };

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
    setLoading(true);
    await NotificationService.sendTest(
      customMessage.title || undefined,
      customMessage.body || undefined
    );
    setLoading(false);
    setSuccessMessage('Test notification sent!');
    setTimeout(() => setSuccessMessage(''), 3000);
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

    if (permissionStatus !== 'granted') {
      alert('Notifications not enabled');
      return;
    }

    setLoading(true);

    try {
      // Send notification to database so it persists and reaches the target user in real-time
      const targetUserId = customMessage.sendToAll ? null : customMessage.targetUserId || null;
      
      const { error } = await supabase
        .from('notifications')
        .insert({
          title: customMessage.title,
          body: customMessage.body,
          sent_by_user_id: currentUserId,
          target_user_id: targetUserId,
          created_at: new Date().toISOString()
        });

      if (error) {
        throw error;
      }

      // Also send immediately to self if testing
      if (customMessage.sendToAll || currentUserId === customMessage.targetUserId) {
        await NotificationService.sendTest(customMessage.title, customMessage.body);
      }

      setSuccessMessage('Notification sent successfully!');
      setCustomMessage({ title: '', body: '', sendToAll: true, targetUserId: '' });
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error sending notification:', error);
      alert(`Error sending notification: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl p-6 max-h-96 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-900">Notification Center</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Permission Status */}
        <div className="mb-4 p-3 rounded-lg bg-gray-100">
          <div className="text-sm text-gray-600 mb-2">
            <strong>Permission Status:</strong> <span className="capitalize font-semibold">{permissionStatus}</span>
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

        {/* Test Notification */}
        <div className="mb-4 pb-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-2">Test Notification</h3>
          <div className="space-y-2 mb-3">
            <input
              type="text"
              placeholder="Custom title (optional)"
              value={customMessage.title}
              onChange={(e) => setCustomMessage({ ...customMessage, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <textarea
              placeholder="Custom message (optional)"
              value={customMessage.body}
              onChange={(e) => setCustomMessage({ ...customMessage, body: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none h-16"
            />
          </div>
          <button
            onClick={handleSendTest}
            disabled={loading || permissionStatus !== 'granted'}
            className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
          >
            {loading ? 'Sending...' : '🧪 Send Test Notification'}
          </button>
        </div>

        {/* Send Custom Message to Users */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">Send Custom Message</h3>
          
          <div className="mb-3">
            <label className="flex items-center text-sm text-gray-700 mb-2">
              <input
                type="checkbox"
                checked={customMessage.sendToAll}
                onChange={(e) => setCustomMessage({
                  ...customMessage,
                  sendToAll: e.target.checked,
                  targetUserId: e.target.checked ? '' : customMessage.targetUserId
                })}
                className="mr-2 w-4 h-4"
              />
              Send to All Users
            </label>
            
            {!customMessage.sendToAll && (
              <div className="relative">
                <button
                  onClick={() => setShowUserSelect(!showUserSelect)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-left text-sm bg-white hover:bg-gray-50"
                >
                  {customMessage.targetUserId 
                    ? users.find(u => u.id === customMessage.targetUserId)?.name || 'Select user'
                    : 'Select user'}
                </button>
                {showUserSelect && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {users.map(user => (
                      <button
                        key={user.id}
                        onClick={() => {
                          setCustomMessage({ ...customMessage, targetUserId: user.id });
                          setShowUserSelect(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b border-gray-100 last:border-0"
                      >
                        {user.name}
                      </button>
                    ))}
                  </div>
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
            disabled={loading || permissionStatus !== 'granted'}
            className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
          >
            {loading ? 'Sending...' : '📤 Send Message'}
          </button>
        </div>
      </div>
    </div>
  );
};
