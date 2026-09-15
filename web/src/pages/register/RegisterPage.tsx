import { useState } from 'react';
import { Alert, Button, Form, Input, Typography } from 'antd';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/auth-api';
import { useAuthStore } from '../../state';

type RegisterForm = { email: string; password: string; confirmPassword: string };
type RegisterLocationState = { from?: string };

// 注册成功后进入独立登录页，不直接建立会话。
export function RegisterPage() {
  const token = useAuthStore((state) => state.token);
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as RegisterLocationState | null;
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (token) return <Navigate to="/caller" replace />;

  const returnPath = state?.from?.startsWith('/') ? state.from : '/caller';

  async function register(values: RegisterForm): Promise<void> {
    setError('');
    setLoading(true);
    try {
      const email = values.email.trim().toLowerCase();
      await authApi.register({ email, password: values.password });
      navigate('/login', {
        replace: true,
        state: { from: returnPath, success: '注册成功，请使用新账号登录' },
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '请求失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  return <main className="auth-overlay">
    <div className="auth-decoration auth-decoration-one" />
    <div className="auth-decoration auth-decoration-two" />
    <section className="auth-panel">
      <div className="auth-brand"><span className="brand-logo">B</span><div><Typography.Title level={2}>Bubhe 天枢</Typography.Title><Typography.Text type="secondary">本地模型协作平台</Typography.Text></div></div>
      <div className="auth-heading"><Typography.Title level={3}>创建账号</Typography.Title><Typography.Paragraph type="secondary">注册后即可管理设备、密钥与使用情况。</Typography.Paragraph></div>
      <Form layout="vertical" requiredMark={false} onFinish={(values: RegisterForm) => void register(values)}>
        <Form.Item label="邮箱" name="email" rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}><Input size="large" autoComplete="email" placeholder="name@example.com" /></Form.Item>
        <Form.Item label="密码" name="password" rules={[{ required: true, min: 8, message: '密码至少 8 位' }]}><Input.Password size="large" autoComplete="new-password" placeholder="请输入密码" /></Form.Item>
        <Form.Item label="确认密码" name="confirmPassword" dependencies={['password']} rules={[{ required: true, message: '请再次输入密码' }, ({ getFieldValue }) => ({ validator(_, value) { return !value || getFieldValue('password') === value ? Promise.resolve() : Promise.reject(new Error('两次输入的密码不一致')); } })]}><Input.Password size="large" autoComplete="new-password" placeholder="请再次输入密码" /></Form.Item>
        {error && <Alert className="auth-error" type="error" showIcon message={error} />}
        <Button type="primary" htmlType="submit" size="large" loading={loading} block>注册</Button>
        <Typography.Paragraph className="auth-switch">已有账号？<Link className="auth-switch-button" to="/login" state={{ from: returnPath }}>返回登录</Link></Typography.Paragraph>
      </Form>
    </section>
  </main>;
}
