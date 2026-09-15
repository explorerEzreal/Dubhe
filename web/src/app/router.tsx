import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell, AuthGate } from '../components';
import { CallerDashboardPage } from '../pages/caller-dashboard/CallerDashboardPage';
import { DeployerDashboardPage } from '../pages/deployer-dashboard/DeployerDashboardPage';
import { LoginPage } from '../pages/login';
import { NotFoundPage } from '../pages/not-found/NotFoundPage';
import { SystemUsersPage } from '../pages/system-users';
import { RegisterPage } from '../pages/register';
import { useAuthStore } from '../state';

// 根路径根据本地登录态进入业务首页或登录页。
function HomeRedirect() {
  const token = useAuthStore((state) => state.token);
  return <Navigate to={token ? '/caller' : '/login'} replace />;
}

export function AppRouter() {
  return <Routes>
    <Route path="/" element={<HomeRedirect />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/deployer" element={<AuthGate><AppShell><DeployerDashboardPage /></AppShell></AuthGate>} />
    <Route path="/caller" element={<AuthGate><AppShell><CallerDashboardPage /></AppShell></AuthGate>} />
    <Route path="/admin/users" element={<AuthGate><AppShell><SystemUsersPage /></AppShell></AuthGate>} />
    <Route path="*" element={<AuthGate><AppShell><NotFoundPage /></AppShell></AuthGate>} />
  </Routes>;
}
