export interface User {
  id: string;
  username: string;
  email?: string;
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
  roleName: string;
  userId: string | null;
  isLocked?: boolean;
  speechDetails?: SpeechDetails;
}

// 🟢 UPDATE: Added 'no' to status
export type RSVPStatus = 'yes' | 'maybe' | 'no';

export interface RSVP {
  // 🟢 UPDATE: Allow null for guests
  userId: string | null;
  name: string;
  status: RSVPStatus;
  isGuest: boolean;
}

export interface Meeting {
  id: string;
  date: string;
  title: string;
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
  sent_by_user_id?: string;
  target_user_id: string | null;
  created_at: string;
}

export interface Device {
  id: string;
  user_id: string | null;
  last_login_at: string;
  user_agent: string;
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