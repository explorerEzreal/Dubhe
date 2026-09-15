import { apiFetch } from './client';

export interface SystemUser { id: string; email: string; role: string; nickname?: string | null; createdAt?: string; }

export const userApi = {
  list(): Promise<SystemUser[]> { return apiFetch<SystemUser[]>('/api/admin/users'); },
  me(): Promise<SystemUser> { return apiFetch<SystemUser>('/api/me'); },
  updateProfile(input: { email: string; nickname: string | null; currentPassword: string }): Promise<SystemUser> { return apiFetch<SystemUser>('/api/me/profile', { method: 'PATCH', body: JSON.stringify(input) }); },
  changeOwnPassword(input: { currentPassword: string; newPassword: string }): Promise<void> { return apiFetch<void>('/api/me/password', { method: 'PATCH', body: JSON.stringify(input) }); },
  changePassword(id: string, newPassword: string): Promise<void> { return apiFetch<void>(`/api/admin/users/${id}/password`, { method: 'PATCH', body: JSON.stringify({ newPassword }) }); },
  delete(id: string): Promise<void> { return apiFetch<void>(`/api/admin/users/${id}`, { method: 'DELETE' }); },
};
