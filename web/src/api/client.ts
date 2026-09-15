import { config } from '../config/config';
import axios, { AxiosError } from 'axios';
import { useAuthStore } from '../state';

export type ApiErrorBody = {
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
};

// 唯一的 Cloud API 访问入口。所有模块通过此函数发起请求。
const apiClient = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((request) => {
  const token = localStorage.getItem('access_token');
  if (token) request.headers.set('Authorization', `Bearer ${token}`);
  return request;
});

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const headers = init?.headers instanceof Headers
      ? Object.fromEntries(init.headers.entries())
      : Array.isArray(init?.headers)
        ? Object.fromEntries(init.headers)
        : init?.headers;
    const response = await apiClient.request<T>({
      url: path,
      method: init?.method,
      data: init?.body,
      headers,
    });
    return response.data;
  } catch (caught) {
    const error = caught as AxiosError<ApiErrorBody>;
    const requestUrl = error.config?.url ?? '';
    const requestHeaders = error.config?.headers;
    const authorization = typeof requestHeaders?.get === 'function'
      ? requestHeaders.get('Authorization')
      : requestHeaders?.Authorization ?? requestHeaders?.authorization;
    // 仅已携带旧 Token 的受保护请求可使当前会话失效，避免登录前请求的 401 竞态清掉新 Token。
    if (
      error.response?.status === 401
      && typeof authorization === 'string'
      && authorization.startsWith('Bearer ')
      && !requestUrl.startsWith('/api/auth/')
    ) {
      useAuthStore.getState().logout();
    }
    const message = error.response?.data?.error?.message;
    throw new Error(typeof message === 'string' && message ? message : '请求失败，请稍后重试');
  }
}
