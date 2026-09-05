import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from '../pages/login/LoginPage';
import { RegisterPage } from '../pages/register/RegisterPage';
import { DeployerDashboardPage } from '../pages/deployer-dashboard/DeployerDashboardPage';
import { CallerDashboardPage } from '../pages/caller-dashboard/CallerDashboardPage';
import { NotFoundPage } from '../pages/not-found/NotFoundPage';
import { useAuthStore } from '../state';
import { AppShell } from '../components';

function Protected({ children }: { children: JSX.Element }) {
  const token = useAuthStore((state) => state.token);
  return token ? children : <Navigate to="/login" replace />;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/deployer" element={<Protected><AppShell><DeployerDashboardPage /></AppShell></Protected>} />
      <Route path="/caller" element={<Protected><AppShell><CallerDashboardPage /></AppShell></Protected>} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
