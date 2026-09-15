import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../state';

// 业务页面统一通过此守卫校验登录态，并保留完整返回地址。
export function AuthGate({ children }: { children: ReactNode }) {
  const token = useAuthStore((state) => state.token);
  const location = useLocation();

  if (token) return children;

  const from = `${location.pathname}${location.search}${location.hash}`;
  return <Navigate to="/login" replace state={{ from }} />;
}
