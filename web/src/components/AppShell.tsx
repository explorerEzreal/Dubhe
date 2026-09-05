import { Layout, Menu, Space, Typography, Button } from 'antd';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../state';

const menuItems = [
  { key: '/deployer', label: '部署者控制台' },
  { key: '/caller', label: '调用者控制台' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);

  return (
    <Layout className="app-layout">
      <Layout.Header className="app-header">
        <Typography.Title level={4} className="app-title">Dubhe 本地模型平台</Typography.Title>
        <Space>
          <Menu
            theme="dark"
            mode="horizontal"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
          />
          <Button type="text" danger onClick={() => { logout(); navigate('/login'); }}>退出登录</Button>
        </Space>
      </Layout.Header>
      <Layout.Content className="app-content">{children}</Layout.Content>
    </Layout>
  );
}
