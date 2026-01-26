import { supabase } from './supabaseClient';
import { Device } from '../types';

/**
 * Device Tracking Service
 * Tracks devices and their associated users for efficient notification delivery
 */

// Generate a unique device ID (persists across sessions)
const getDeviceId = (): string => {
  let deviceId = localStorage.getItem('device_id');
  
  if (!deviceId) {
    // Generate a unique device fingerprint
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx?.fillText('device-fingerprint', 2, 2);
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      canvas.toDataURL()
    ].join('|');
    
    // Create a simple hash
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    deviceId = `device-${Math.abs(hash).toString(36)}-${Date.now().toString(36)}`;
    localStorage.setItem('device_id', deviceId);
  }
  
  return deviceId;
};

export const DeviceService = {
  /**
   * Get or create device ID
   */
  getDeviceId,

  /**
   * Register or update device with current user
   * Called when user logs in
   */
  registerDevice: async (userId: string | null): Promise<Device | null> => {
    const deviceId = getDeviceId();
    const userAgent = navigator.userAgent;
    const now = new Date().toISOString();

    try {
      // Upsert device record
      const { data, error } = await supabase
        .from('devices')
        .upsert({
          id: deviceId,
          user_id: userId,
          last_login_at: userId ? now : null,
          user_agent: userAgent,
          updated_at: now
        }, {
          onConflict: 'id'
        })
        .select()
        .single();

      if (error) {
        console.error('Error registering device:', error);
        return null;
      }

      console.log('✅ Device registered:', deviceId, 'for user:', userId);
      return data as Device;
    } catch (error) {
      console.error('Failed to register device:', error);
      return null;
    }
  },

  /**
   * Get current device info
   */
  getCurrentDevice: async (): Promise<Device | null> => {
    const deviceId = getDeviceId();

    try {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .eq('id', deviceId)
        .single();

      if (error || !data) {
        return null;
      }

      return data as Device;
    } catch (error) {
      console.error('Failed to get device:', error);
      return null;
    }
  },

  /**
   * Clear device registration (on logout)
   */
  clearDevice: async (): Promise<void> => {
    const deviceId = getDeviceId();

    try {
      await supabase
        .from('devices')
        .update({
          user_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', deviceId);
      
      console.log('✅ Device cleared for logout');
    } catch (error) {
      console.error('Failed to clear device:', error);
    }
  },

  /**
   * Get all devices for a user (admin function)
   */
  getUserDevices: async (userId: string): Promise<Device[]> => {
    try {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .eq('user_id', userId)
        .order('last_login_at', { ascending: false });

      if (error) {
        console.error('Error fetching user devices:', error);
        return [];
      }

      return (data || []) as Device[];
    } catch (error) {
      console.error('Failed to get user devices:', error);
      return [];
    }
  }
};
