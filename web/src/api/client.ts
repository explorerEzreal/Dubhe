import { config } from '../config/config';
import axios, { AxiosError } from 'axios';

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

apiClient.interceptors.response.use((response) => {
  const token = response.headers['x-access-token'];
  if (typeof token === 'string' && token) localStorage.setItem('access_token', token);
  return response;
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
    if (error.response?.status === 401) localStorage.removeItem('access_token');
    const message = error.response?.data?.error?.message;
    throw new Error(typeof message === 'string' && message ? message : '请求失败，请稍后重试');
  }
}
