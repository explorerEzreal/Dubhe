import { apiFetch } from './client';

export interface UsageSummary {
  totalCalls: number;
  errorRate: number;
  avgLatencyMs: number;
}

export const usageApi = {
  summary(): Promise<UsageSummary> {
    return apiFetch<UsageSummary>('/api/usage');
  },
};
