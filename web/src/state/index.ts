import { create } from 'zustand';

export type AuthState = { token: string | null; email: string | null; role: string | null; setSession: (token: string, email: string, role: string) => void; logout: () => void };
export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('access_token'),
  email: localStorage.getItem('user_email'),
  role: localStorage.getItem('user_role'),
  setSession: (token, email, role) => { localStorage.setItem('access_token', token); localStorage.setItem('user_email', email); localStorage.setItem('user_role', role); set({ token, email, role }); },
  logout: () => { localStorage.removeItem('access_token'); localStorage.removeItem('user_email'); localStorage.removeItem('user_role'); set({ token: null, email: null, role: null }); },
}));
