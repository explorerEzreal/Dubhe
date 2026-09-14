import { Routes, Route, Navigate } from 'react-router-dom';
import { DeployerDashboardPage } from '../pages/deployer-dashboard/DeployerDashboardPage';
import { CallerDashboardPage } from '../pages/caller-dashboard/CallerDashboardPage';
import { NotFoundPage } from '../pages/not-found/NotFoundPage';
import { AppShell, AuthGate } from '../components';

export function AppRouter() {
  return (
    <AuthGate><Routes><Route path="/" element={<Navigate to="/caller" replace />} /><Route path="/login" element={<Navigate to="/caller" replace />} /><Route path="/register" element={<Navigate to="/caller" replace />} /><Route path="/deployer" element={<AppShell><DeployerDashboardPage /></AppShell>} /><Route path="/caller" element={<AppShell><CallerDashboardPage /></AppShell>} /><Route path="*" element={<AppShell><NotFoundPage /></AppShell>} /></Routes></AuthGate>
  );
}
