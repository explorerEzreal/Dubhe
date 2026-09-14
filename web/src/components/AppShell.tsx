import { Tooltip, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppTheme } from '../app/providers';
import { useAuthStore } from '../state';

type IconName = 'device' | 'key' | 'dashboard' | 'logs' | 'plus' | 'menu' | 'sun' | 'moon' | 'settings';
const navItems = [{ key: 'device', label: '设备管理', path: '/deployer', icon: 'device' as IconName }, { key: 'keys', label: 'API 密钥', path: '/caller', icon: 'key' as IconName }, { key: 'dashboard', label: '数据看板', path: '/caller', icon: 'dashboard' as IconName }, { key: 'logs', label: '使用日志', path: '/caller', icon: 'logs' as IconName }];

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, string> = { device: 'M4 5h16v14H4z M8 9h8 M8 13h5', key: 'M14 7a4 4 0 1 0-2 3.46L20 18l-2 2-2-2 1-1-2-2 1-1-2-2', dashboard: 'M5 19V9 M12 19V5 M19 19v-7', logs: 'M6 4h12v16H6z M9 8h6 M9 12h6 M9 16h4', plus: 'M12 5v14 M5 12h14', menu: 'M4 7h16 M4 12h16 M4 17h16', sun: 'M12 3v2 M12 19v2 M3 12h2 M19 12h2 M5.64 5.64l1.41 1.41 M16.95 16.95l1.41 1.41 M5.64 18.36l1.41-1.41 M16.95 7.05l1.41-1.41 M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8', moon: 'M20 15.5A8 8 0 0 1 8.5 4 8 8 0 1 0 20 15.5', settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8'};
  return <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation(); const navigate = useNavigate(); const { mode, toggleTheme } = useAppTheme();
  const { email, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('shibawork_sidebar') === 'true');
  const [activeKey, setActiveKey] = useState(() => location.pathname === '/deployer' ? 'device' : 'dashboard');
  function toggleCollapsed(): void { setCollapsed((value) => { localStorage.setItem('shibawork_sidebar', String(!value)); return !value; }); }
  return <div className={`app-shell ${collapsed ? 'is-collapsed' : ''}`}>
    <aside className="sidebar">
      <div className="sidebar-header"><div className="brand-mark">S</div><div className="brand-copy"><strong>ShibaWork</strong><small>v0.1.0</small></div><button className="collapse-button" onClick={toggleCollapsed} aria-label="收起侧边栏"><Icon name="menu" /></button></div>
      <button className="new-task-button"><Icon name="plus" /><span>新建任务</span></button>
      <nav className="sidebar-nav">{navItems.map((item) => { const content = <button className={`nav-item ${activeKey === item.key ? 'active' : ''}`} onClick={() => { setActiveKey(item.key); navigate(item.path); }}><Icon name={item.icon} /><span>{item.label}</span></button>; return collapsed ? <Tooltip key={item.key} title={item.label} placement="right">{content}</Tooltip> : <div key={item.key}>{content}</div>; })}</nav>
      {!collapsed && <div className="sidebar-lists"><div className="list-title">任务 <span>(1)</span></div><div className="task-item active"><strong>你好</strong><small>10天前</small></div><div className="list-title">空间 <span>(1)</span></div><div className="space-item">项目新手指引</div></div>}
      <div className="sidebar-footer"><div className="footer-actions"><button className="theme-button" onClick={toggleTheme} aria-label="切换主题"><Icon name={mode === 'light' ? 'moon' : 'sun'} /></button></div><div className="user-profile"><span className="avatar">{(email?.[0] ?? 'U').toUpperCase()}</span><span className="user-email">{email ?? '已登录用户'}</span><button className="settings-button" onClick={logout} aria-label="退出登录"><Icon name="settings" /></button></div></div>
    </aside><main className="main-content"><header className="content-header"><Typography.Text type="secondary">内容</Typography.Text></header><div className="content-scroll">{children}</div></main>
  </div>;
}
