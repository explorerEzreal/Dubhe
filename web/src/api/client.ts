import { config } from '../config/config';

export type ApiErrorBody = {
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
};

// 唯一的 Cloud API 访问入口。所有模块通过此函数发起请求。
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem('access_token');
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let res: Response;
  try { res = await fetch(`${config.apiBaseUrl}${path}`, { ...init, headers }); } catch { throw new Error('请求失败，请稍后重试'); }
  if (!res.ok) {
    if (res.status === 401) localStorage.removeItem('access_token');
    throw new Error('请求失败，请稍后重试');
  }
  if (res.status === 204) return undefined as T;
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error('请求失败，请稍后重试');
  }
}
