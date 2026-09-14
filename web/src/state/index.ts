import { create } from 'zustand';

type AuthState = { token: string | null; email: string | null; setSession: (token: string, email: string) => void; logout: () => void };
export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('access_token'),
  email: localStorage.getItem('user_email'),
  setSession: (token, email) => { localStorage.setItem('access_token', token); localStorage.setItem('user_email', email); set({ token, email }); },
  logout: () => { localStorage.removeItem('access_token'); localStorage.removeItem('user_email'); set({ token: null, email: null }); },
}));
