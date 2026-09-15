import { useEffect, useState } from 'react';
import { Alert, Card, Table, Tag, Typography } from 'antd';
import { userApi, type SystemUser } from '../../api/user-api';
import { LoadingState } from '../../components';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../state';

export function SystemUsersPage() {
  const role = useAuthStore((state) => state.role);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  if (role !== 'admin') return <Navigate to='/caller' replace />;

  useEffect(() => {
    let active = true;
    userApi.list().then((result) => { if (active) setUsers(result); }).catch(() => { if (active) setError('请求失败，请稍后重试'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <LoadingState />;
  return <Card title={<Typography.Title level={3} style={{ margin: 0 }}>系统用户</Typography.Title>}>
    {error && <Alert type='error' message={error} showIcon />}
    <Table rowKey='id' dataSource={users} pagination={false} columns={[
      { title: '邮箱', dataIndex: 'email' },
      { title: '角色', dataIndex: 'role', render: (role: string) => <Tag color={role === 'admin' ? 'gold' : 'default'}>{role === 'admin' ? '管理员' : '普通用户'}</Tag> },
      { title: '用户 ID', dataIndex: 'id' },
      { title: '注册时间', dataIndex: 'createdAt', render: (value?: string) => value ? new Date(value).toLocaleString() : '—' },
    ]} />
  </Card>;
}
