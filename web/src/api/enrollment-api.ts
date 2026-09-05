import { apiFetch } from './client';

export interface EnrollmentTokenResult {
  token: string;
  expiresIn: number;
}

export const enrollmentApi = {
  create(): Promise<EnrollmentTokenResult> {
    return apiFetch<EnrollmentTokenResult>('/api/enrollment-tokens', { method: 'POST' });
  },
};
