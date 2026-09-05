import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { authApi } from '../../api/auth-api';

export function RegisterPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  async function onSubmit(values: { email: string; password: string }) {
    setError('');
    try {
      await authApi.register(values);
      navigate('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
    }
  }

  return <main className="auth-page"><Card title={<Typography.Title level={2}>注册 Dubhe</Typography.Title>} className="auth-card">
    <Form layout="vertical" onFinish={onSubmit}>
      <Form.Item label="邮箱" name="email" rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}><Input autoComplete="email" /></Form.Item>
      <Form.Item label="密码" name="password" rules={[{ required: true, min: 8, message: '密码至少 8 位' }]}><Input.Password autoComplete="new-password" /></Form.Item>
      {error && <Alert type="error" showIcon message={error} />}
      <Button type="primary" htmlType="submit" block>注册</Button>
      <Typography.Paragraph style={{ marginTop: 16, textAlign: 'center' }}>已有账号？<Link to="/login">返回登录</Link></Typography.Paragraph>
    </Form>
  </Card></main>;
}
