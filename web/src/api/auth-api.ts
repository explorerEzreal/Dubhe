import { apiFetch } from './client';

export interface RegisterInput {
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
}

export const authApi = {
  register(input: RegisterInput): Promise<AuthResponse> {
    return apiFetch<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  login(input: LoginInput): Promise<AuthResponse> {
    return apiFetch<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
};
