import { apiFetch } from './client';

export interface ApiKeySummary {
  id: string;
  prefix: string;
  status: string;
  createdAt: string;
  expiresAt?: string | null;
}

export interface ApiKeyCreateResult extends ApiKeySummary {
  plaintext: string;
}

export const keyApi = {
  list(): Promise<ApiKeySummary[]> {
    return apiFetch<ApiKeySummary[]>('/api/keys');
  },
  create(input: { models: string[]; expiresAt?: string | null }): Promise<ApiKeyCreateResult> {
    return apiFetch<ApiKeyCreateResult>('/api/keys', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  disable(id: string): Promise<void> {
    return apiFetch<void>(`/api/keys/${id}/disable`, { method: 'POST' });
  },
  remove(id: string): Promise<void> {
    return apiFetch<void>(`/api/keys/${id}`, { method: 'DELETE' });
  },
};
