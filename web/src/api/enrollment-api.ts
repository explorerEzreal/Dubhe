import { apiFetch } from './client';

export interface EnrollmentTokenResult {
  token: string;
  expiresIn: number;
  agentId: string;
}

export const enrollmentApi = {
  create(name: string): Promise<EnrollmentTokenResult> {
    return apiFetch<EnrollmentTokenResult>('/api/enrollment-tokens', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },
};
