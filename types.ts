
export interface User {
  id: string;
  username: string;
  email?: string; // Added email field
  name: string;
  avatar: string;
  isAdmin: boolean;
  isGuest?: boolean;
}

export interface SpeechDetails {
  pathway: string;
  level: string;
  project: string;
  title: string;
}

export interface Slot {
  id: string;
  roleName: string; // e.g., "Toastmaster of the Day", "Speaker 1"
  userId: string | null; // null if open
  isLocked?: boolean; // If admin locks a slot
  speechDetails?: SpeechDetails;
}

export type RSVPStatus = 'yes' | 'maybe';

export interface RSVP {
  userId: string;
  name: string;
  status: RSVPStatus;
  isGuest: boolean;
}

export interface Meeting {
  id: string;
  date: string; // ISO Date string
  title: string; // e.g. "Weekly Meeting #104"
  type: 'Regular' | 'Special' | 'Contest';
  slots: Slot[];
  theme?: string;
  wordOfTheDay?: string;
  venue?: string;
  time?: string;
  rsvps: RSVP[];
}

export interface NotificationLog {
  id: string;
  title: string;
  body: string;
  sent_by_user_id?: string; // Optional: who sent the notification
  target_user_id: string | null; // null means 'everyone'
  created_at: string;
}

export interface Device {
  id: string; // Device fingerprint/ID
  user_id: string | null; // Currently logged-in user (null if guest or logged out)
  last_login_at: string; // Last time a user logged in on this device
  user_agent: string; // Browser info
  created_at: string;
  updated_at: string;
}

export const DEFAULT_AVATAR = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
export const DEFAULT_GUEST_AVATAR = "https://cdn-icons-png.flaticon.com/512/1077/1077114.png";

export const DEFAULT_ROLES = [
  "Toastmaster of the Day",
  "Table Topics Master",
  "General Evaluator",
  "Prepared Speaker 1",
  "Prepared Speaker 2",
  "Evaluator 1",
  "Evaluator 2",
  "Timer",
  "Ah-Counter",
  "Grammarian"
];