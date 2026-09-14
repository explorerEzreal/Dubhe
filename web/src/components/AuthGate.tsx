import { useState, type ReactNode } from 'react';
import { Alert, Button, Form, Input, Typography } from 'antd';
import { authApi } from '../api/auth-api';
import { useAuthStore } from '../state';

type LoginForm = { email: string; password: string };

export function AuthGate({ children }: { children: ReactNode }) {
  const token = useAuthStore((state) => state.token);
  const setSession = useAuthStore((state) => state.setSession);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function login(values: LoginForm): Promise<void> {
    setError(''); setLoading(true);
    try { const result = await authApi.login(values); setSession(result.token, values.email.trim().toLowerCase()); }
    catch { setError('请求失败，请稍后重试'); }
    finally { setLoading(false); }
  }
  if (token) return children;
  return <main className="auth-overlay"><div className="auth-decoration auth-decoration-one" /><div className="auth-decoration auth-decoration-two" /><section className="auth-panel">
    <div className="auth-brand"><span className="brand-logo">S</span><div><Typography.Title level={2}>ShibaWork</Typography.Title><Typography.Text type="secondary">本地模型协作平台</Typography.Text></div></div>
    <div className="auth-heading"><Typography.Title level={3}>欢迎回来</Typography.Title><Typography.Paragraph type="secondary">登录后继续管理设备、密钥与使用情况。</Typography.Paragraph></div>
    <Form layout="vertical" requiredMark={false} onFinish={(values: LoginForm) => void login(values)}>
      <Form.Item label="邮箱" name="email" rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}><Input size="large" autoComplete="email" placeholder="name@example.com" /></Form.Item>
      <Form.Item label="密码" name="password" rules={[{ required: true, min: 8, message: '密码至少 8 位' }]}><Input.Password size="large" autoComplete="current-password" placeholder="请输入密码" /></Form.Item>
      {error && <Alert className="auth-error" type="error" showIcon message={error} />}
      <Button type="primary" htmlType="submit" size="large" loading={loading} block>登录</Button>
    </Form>
  </section></main>;
}
