import { useState, type ReactNode } from 'react';
import { Alert, Button, Form, Input, Typography } from 'antd';
import { authApi } from '../api/auth-api';
import { useAuthStore } from '../state';

type AuthForm = { email: string; password: string; confirmPassword?: string };

export function AuthGate({ children }: { children: ReactNode }) {
  const token = useAuthStore((state) => state.token);
  const setSession = useAuthStore((state) => state.setSession);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [form] = Form.useForm<AuthForm>();
  async function submit(values: AuthForm): Promise<void> {
    setError(''); setLoading(true);
    try {
      const email = values.email.trim().toLowerCase();
      if (isRegistering) {
        await authApi.register({ email, password: values.password });
        form.setFieldsValue({ email, password: '' });
        setIsRegistering(false);
        setError('注册成功，请使用新账号登录');
      } else {
        const result = await authApi.login({ email, password: values.password });
        setSession(result.token, email);
      }
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : '请求失败，请稍后重试'); }
    finally { setLoading(false); }
  }
  function switchMode(): void { setError(''); setIsRegistering((value) => !value); form.resetFields(); }
  if (token) return children;
  return <main className="auth-overlay"><div className="auth-decoration auth-decoration-one" /><div className="auth-decoration auth-decoration-two" /><section className="auth-panel">
    <div className="auth-brand"><span className="brand-logo">S</span><div><Typography.Title level={2}>ShibaWork</Typography.Title><Typography.Text type="secondary">本地模型协作平台</Typography.Text></div></div>
    <div className="auth-heading"><Typography.Title level={3}>{isRegistering ? '创建账号' : '欢迎回来'}</Typography.Title><Typography.Paragraph type="secondary">{isRegistering ? '注册后即可登录并管理设备、密钥与使用情况。' : '登录后继续管理设备、密钥与使用情况。'}</Typography.Paragraph></div>
    <Form form={form} layout="vertical" requiredMark={false} onFinish={(values: AuthForm) => void submit(values)}>
      <Form.Item label="邮箱" name="email" rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}><Input size="large" autoComplete="email" placeholder="name@example.com" /></Form.Item>
      <Form.Item label="密码" name="password" rules={[{ required: true, min: 8, message: '密码至少 8 位' }]}><Input.Password size="large" autoComplete="current-password" placeholder="请输入密码" /></Form.Item>
      {isRegistering && <Form.Item label="确认密码" name="confirmPassword" dependencies={['password']} rules={[{ required: true, message: '请再次输入密码' }, ({ getFieldValue }) => ({ validator(_, value) { return !value || getFieldValue('password') === value ? Promise.resolve() : Promise.reject(new Error('两次输入的密码不一致')); } })]}><Input.Password size="large" autoComplete="new-password" placeholder="请再次输入密码" /></Form.Item>}
      {error && <Alert className="auth-error" type="error" showIcon message={error} />}
      <Button type="primary" htmlType="submit" size="large" loading={loading} block>{isRegistering ? '注册' : '登录'}</Button>
      <Typography.Paragraph className="auth-switch">{isRegistering ? '已有账号？' : '还没有账号？'}<button type="button" className="auth-switch-button" onClick={switchMode}>{isRegistering ? '返回登录' : '立即注册'}</button></Typography.Paragraph>
    </Form>
  </section></main>;
}
