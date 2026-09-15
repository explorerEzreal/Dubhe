import { create } from 'zustand';

export type AuthState = { token: string | null; userId: string | null; email: string | null; nickname: string | null; role: string | null; setSession: (token: string, email: string, role: string, nickname?: string | null, userId?: string | null) => void; setProfile: (email: string, nickname: string | null) => void; logout: () => void };
export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('access_token'),
  userId: localStorage.getItem('user_id'),
  email: localStorage.getItem('user_email'),
  nickname: localStorage.getItem('user_nickname'),
  role: localStorage.getItem('user_role'),
  setSession: (token, email, role, nickname = null, userId = null) => { localStorage.setItem('access_token', token); localStorage.setItem('user_id', userId ?? ''); localStorage.setItem('user_email', email); localStorage.setItem('user_role', role); localStorage.setItem('user_nickname', nickname ?? ''); set({ token, userId, email, role, nickname }); },
  setProfile: (email, nickname) => { localStorage.setItem('user_email', email); localStorage.setItem('user_nickname', nickname ?? ''); set({ email, nickname }); },
  logout: () => { localStorage.removeItem('access_token'); localStorage.removeItem('user_id'); localStorage.removeItem('user_email'); localStorage.removeItem('user_role'); localStorage.removeItem('user_nickname'); set({ token: null, userId: null, email: null, nickname: null, role: null }); },
}));
