import { useState } from 'react';
import { Alert, Button, Form, Input, Typography } from 'antd';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/auth-api';
import { useAuthStore } from '../../state';

type LoginForm = { email: string; password: string };
type LoginLocationState = { from?: string; success?: string };

// 登录成功后返回触发认证跳转前的业务地址。
export function LoginPage() {
  const token = useAuthStore((state) => state.token);
  const setSession = useAuthStore((state) => state.setSession);
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LoginLocationState | null;
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (token) return <Navigate to='/caller' replace />;

  const returnPath = state?.from?.startsWith('/') ? state.from : '/caller';

  async function login(values: LoginForm): Promise<void> {
    setError('');
    setLoading(true);
    try {
      const email = values.email.trim().toLowerCase();
      const result = await authApi.login({ email, password: values.password });
      setSession(
        result.token,
        email,
        result.user.role,
        result.user.nickname,
        result.user.id,
      );
      navigate(returnPath, { replace: true });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : '请求失败，请稍后重试',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className='auth-overlay'>
      <div className='auth-decoration auth-decoration-one' />
      <div className='auth-decoration auth-decoration-two' />
      <section className='auth-panel'>
        <div className='auth-brand'>
          <span className='brand-logo'>B</span>
          <div>
            <Typography.Title level={2}>Bubhe 天枢</Typography.Title>
            <Typography.Text type='secondary'>本地模型协作平台</Typography.Text>
          </div>
        </div>
        <div className='auth-heading'>
          <Typography.Title level={3}>欢迎回来</Typography.Title>
          <Typography.Paragraph type='secondary'>
            登录后继续管理设备、密钥与使用情况。
          </Typography.Paragraph>
        </div>
        <Form
          layout='vertical'
          requiredMark={false}
          onFinish={(values: LoginForm) => void login(values)}
        >
          <Form.Item
            label='邮箱'
            name='email'
            rules={[
              { required: true, type: 'email', message: '请输入有效邮箱' },
            ]}
          >
            <Input
              size='large'
              autoComplete='email'
              placeholder='name@example.com'
            />
          </Form.Item>
          <Form.Item
            label='密码'
            name='password'
            rules={[{ required: true, min: 8, message: '密码至少 8 位' }]}
          >
            <Input.Password
              size='large'
              autoComplete='current-password'
              placeholder='请输入密码'
            />
          </Form.Item>
          {state?.success && (
            <Alert
              className='auth-error'
              type='success'
              showIcon
              message={state.success}
            />
          )}
          {error && (
            <Alert
              className='auth-error'
              type='error'
              showIcon
              message={error}
            />
          )}
          <Button
            type='primary'
            htmlType='submit'
            size='large'
            loading={loading}
            block
          >
            登录
          </Button>
          <Typography.Paragraph className='auth-switch'>
            还没有账号？
            <Link
              className='auth-switch-button'
              to='/register'
              state={{ from: returnPath }}
            >
              立即注册
            </Link>
          </Typography.Paragraph>
        </Form>
      </section>
    </main>
  );
}
