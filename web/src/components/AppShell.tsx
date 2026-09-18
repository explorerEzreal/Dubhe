import { Button, Layout, Popover, Tooltip } from 'antd';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppTheme } from '../app/providers';
import { useAuthStore } from '../state';
import { AccountSecurityModal } from './AccountSecurityModal';
import { menuGroups, type IconName } from './app-shell-config';

const { Sider, Content } = Layout;

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, string> = {
    device: 'M4 5h16v14H4z M8 9h8 M8 13h5',
    key: 'M14 7a4 4 0 1 0-2 3.46L20 18l-2 2-2-2 1-1-2-2 1-1-2-2',
    dashboard: 'M5 19V9 M12 19V5 M19 19v-7',
    logs: 'M6 4h12v16H6z M9 8h6 M9 12h6 M9 16h4',
    plus: 'M12 5v14 M5 12h14',
    menu: 'M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z M8 4v16',
    appearance:
      'M12 3a9 9 0 1 0 0 18h1.2a2.3 2.3 0 0 0 0-4.6H12a2 2 0 0 1 0-4h1.5A7.5 7.5 0 0 0 12 3z M7.5 8.5h.01 M6.5 13h.01 M10 6h.01',
    logout: 'M10 5H5v14h5 M14 8l4 4-4 4 M18 12H9',
    shield: 'M12 3 19 6v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z M9 12l2 2 4-4',
    sliders: 'M6 4v16 M12 4v16 M18 4v16 M4 8h4 M10 15h4 M16 10h4',
    info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 10v6 M12 7h.01',
    thunderbolt: 'M13 2 4 14h7l-1 8 10-13h-7z',
    group: 'M17 20v-1a3 3 0 0 0-3-3H8a3 3 0 0 0-3 3v1 M6 10a3 3 0 1 0 6 0 3 3 0 0 0-6 0 M15 6.5a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0 M19 12v3 M17.5 13.5h3',
  };
  return (
    <svg
      className='ui-icon'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.8'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      <path d={paths[name]} />
    </svg>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { mode, setTheme } = useAppTheme();
  const { email, nickname, role, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const avatarText = (nickname?.[0] ?? email?.[0] ?? 'U').toUpperCase();
  function handleLogout(): void {
    setProfileOpen(false);
    logout();
  }

  const profileContent = (
    <div className='wb-user-panel'>
      <div className='wb-user-panel-head'>
        <span className='wb-user-panel-avatar'>{avatarText}</span>
        <div className='wb-user-panel-meta'>
          <div className='wb-user-panel-name'>
            {nickname || email || '访客用户'}
          </div>
        </div>
      </div>
      <div className='wb-user-panel-menu'>
        <div
          className='wb-user-panel-item'
          onClick={() => {
            setProfileOpen(false);
            setSecurityOpen(true);
          }}
        >
          <span className='wb-user-panel-item-icon'>
            <Icon name='shield' />
          </span>
          账号与安全
        </div>
        <div className='wb-user-panel-item'>
          <span className='wb-user-panel-item-icon'>
            <Icon name='sliders' />
          </span>
          偏好设置
        </div>
        <div className='wb-user-panel-item'>
          <span className='wb-user-panel-item-icon'>
            <Icon name='info' />
          </span>
          关于 Bubhe 天枢
        </div>
      </div>
      <div className='wb-user-panel-foot'>
        <button className='wb-user-panel-logout' onClick={handleLogout}>
          <Icon name='logout' />
          退出登录
        </button>
        <div className='wb-user-panel-version'>Bubhe v0.1.0</div>
      </div>
    </div>
  );

  return (
    <Layout className='wb-app'>
      <Sider
        width={320}
        collapsedWidth={68}
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        className='wb-sider'
      >
        <div className='wb-sider-inner'>
          {/* Logo */}
          <div className='wb-logo'>
            <span className='wb-logo-mark'>
              <Icon name='thunderbolt' />
            </span>
            {!collapsed && (
              <>
                <span className='wb-logo-name'>Bubhe 天枢</span>
                <span className='wb-logo-version'>v0.1.0</span>
              </>
            )}
          </div>

          {/* 导航 */}
          <div className='wb-sidebar-scroll'>
            <nav className='wb-menu-groups' aria-label='业务菜单'>
              {menuGroups
                .filter(
                  (group) =>
                    group.key !== 'admin' ||
                    role === 'admin' ||
                    role === 'super_admin',
                )
                .map((group) => (
                  <section className='wb-menu-group' key={group.key}>
                    <div className='wb-section-title'>{!collapsed && group.label}</div>
                    <div className='wb-nav'>
                      {group.items.map((item) => {
                        const active = item.path === location.pathname;
                        return (
                          <div
                            className={`wb-nav-item${active ? ' is-active' : ''}${item.path ? '' : ' is-placeholder'}`}
                            key={item.key}
                            onClick={() => item.path && navigate(item.path)}
                            role={item.path ? 'link' : undefined}
                            aria-current={active ? 'page' : undefined}
                          >
                            <span className='wb-nav-icon'>
                              <Icon name={item.icon} />
                            </span>
                            {!collapsed && <span className='wb-nav-label'>{item.label}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
            </nav>
          </div>

          {/* 底部工具栏 */}
          <div className='wb-sider-footer'>
            <div className='wb-sider-toolbar'>
              <Popover
                placement='topLeft'
                trigger='click'
                open={profileOpen}
                onOpenChange={setProfileOpen}
                content={profileContent}
                arrow={false}
                overlayClassName='wb-user-popover'
              >
                <div className='wb-user-trigger'>
                  <span className='wb-user-avatar'>{avatarText}</span>
                  {!collapsed && (
                    <span className='wb-user-meta'>
                      <span className='wb-user-name'>
                        {nickname || email || '访客用户'}
                      </span>
                    </span>
                  )}
                </div>
              </Popover>

              <Tooltip title={mode === 'dark' ? '浅色模式' : '深色模式'}>
                <Button
                  className='wb-toolbar-btn'
                  type='text'
                  icon={<Icon name='appearance' />}
                  onClick={() => setTheme(mode === 'dark' ? 'light' : 'dark')}
                />
              </Tooltip>

              <Tooltip title={collapsed ? '展开侧栏' : '收起侧栏'}>
                <Button
                  className='wb-toolbar-btn'
                  type='text'
                  icon={<Icon name='menu' />}
                  onClick={() => setCollapsed(!collapsed)}
                />
              </Tooltip>
            </div>
          </div>
        </div>
      </Sider>
      <Content className='wb-main'>
        <div className='content-scroll'>{children}</div>
      </Content>
      <AccountSecurityModal
        open={securityOpen}
        onClose={() => setSecurityOpen(false)}
      />
    </Layout>
  );
}
