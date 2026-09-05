import { apiFetch } from './client';

export interface ModelSummary {
  id: string;
  name: string;
  engine: string;
  description?: string | null;
  instanceCount: number;
  readyInstances: number;
  status: string;
}

export const modelApi = {
  list(): Promise<ModelSummary[]> {
    return apiFetch<ModelSummary[]>('/api/models');
  },
};
