import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { authApi } from '../../api/auth-api';
import { useAuthStore } from '../../state';

export function LoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const setToken = useAuthStore((state) => state.setToken);

  async function onSubmit(values: { email: string; password: string }) {
    setError('');
    try {
      const { token } = await authApi.login(values);
      setToken(token);
      navigate('/caller');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    }
  }

  return <main className="auth-page"><Card title={<Typography.Title level={2}>登录 Dubhe</Typography.Title>} className="auth-card">
    <Form layout="vertical" onFinish={onSubmit}>
      <Form.Item label="邮箱" name="email" rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}><Input autoComplete="email" /></Form.Item>
      <Form.Item label="密码" name="password" rules={[{ required: true, min: 8, message: '密码至少 8 位' }]}><Input.Password autoComplete="current-password" /></Form.Item>
      {error && <Alert type="error" showIcon message={error} />}
      <Button type="primary" htmlType="submit" block loading={false}>登录</Button>
      <Typography.Paragraph style={{ marginTop: 16, textAlign: 'center' }}>还没有账号？<Link to="/register">立即注册</Link></Typography.Paragraph>
    </Form>
  </Card></main>;
}
