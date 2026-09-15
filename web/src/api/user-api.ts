import { apiFetch } from './client';

export interface SystemUser { id: string; email: string; role: string; createdAt?: string; }

export const userApi = {
  list(): Promise<SystemUser[]> { return apiFetch<SystemUser[]>('/api/admin/users'); },
};
