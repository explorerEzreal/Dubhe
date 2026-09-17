import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { userApi, type SystemUser } from '../../api/user-api';
import { ContentLoadingState } from '../../components';
import { REQUEST_ERROR_MESSAGE } from '../../constants';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../state';

export function SystemUsersPage() {
  const { role, userId } = useAuthStore();
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [target, setTarget] = useState<SystemUser | null>(null);

  useEffect(() => {
    let active = true;
    userApi
      .list()
      .then((result) => {
        if (active) setUsers(result);
      })
      .catch(() => {
        if (active) setError(REQUEST_ERROR_MESSAGE);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (role !== 'admin' && role !== 'super_admin')
    return <Navigate to='/caller' replace />;

  if (loading) return <ContentLoadingState />;
  async function changePassword(values: { newPassword: string }) {
    if (!target) return;
    try {
      await userApi.changePassword(target.id, values.newPassword);
      setTarget(null);
    } catch {
      setError(REQUEST_ERROR_MESSAGE);
    }
  }
  async function removeUser(user: SystemUser) {
    if (!window.confirm(`确认删除用户 ${user.email}？`)) return;
    try {
      await userApi.delete(user.id);
      setUsers((items) => items.filter((item) => item.id !== user.id));
    } catch {
      setError(REQUEST_ERROR_MESSAGE);
    }
  }
  const canManage = (targetUser: SystemUser) =>
    role === 'super_admin'
      ? targetUser.role !== 'super_admin'
      : role === 'admin' && targetUser.role === 'user';
  return (
    <Card
      title={
        <Typography.Title level={3} style={{ margin: 0 }}>
          系统用户
        </Typography.Title>
      }
    >
      {error && <Alert type='error' message={error} showIcon />}
      <Table
        rowKey='id'
        dataSource={users}
        pagination={false}
        columns={[
          { title: '邮箱', dataIndex: 'email' },
          {
            title: '昵称',
            dataIndex: 'nickname',
            render: (value?: string | null) => value || '—',
          },
          {
            title: '角色',
            dataIndex: 'role',
            render: (role: string) => (
              <Tag
                color={
                  role === 'super_admin'
                    ? 'red'
                    : role === 'admin'
                      ? 'gold'
                      : 'default'
                }
              >
                {role === 'super_admin'
                  ? '超级管理员'
                  : role === 'admin'
                    ? '管理员'
                    : '普通用户'}
              </Tag>
            ),
          },
          { title: '用户 ID', dataIndex: 'id' },
          {
            title: '注册时间',
            dataIndex: 'createdAt',
            render: (value?: string) =>
              value ? new Date(value).toLocaleString() : '—',
          },
          {
            title: '操作',
            key: 'actions',
            render: (_: unknown, user: SystemUser) =>
              canManage(user) && user.id !== userId ? (
                <Space>
                  <Button size='small' onClick={() => setTarget(user)}>
                    修改密码
                  </Button>
                  <Button
                    size='small'
                    danger
                    onClick={() => void removeUser(user)}
                  >
                    删除
                  </Button>
                </Space>
              ) : (
                '—'
              ),
          },
        ]}
      />
      <Modal
        open={Boolean(target)}
        title={`修改 ${target?.email ?? ''} 的密码`}
        footer={null}
        onCancel={() => setTarget(null)}
        destroyOnClose
      >
        <Form
          layout='vertical'
          onFinish={(values) => void changePassword(values)}
        >
          <Form.Item
            label='新密码'
            name='newPassword'
            rules={[{ required: true, min: 8 }]}
          >
            <Input.Password />
          </Form.Item>
          <Button type='primary' htmlType='submit'>
            保存
          </Button>
        </Form>
      </Modal>
    </Card>
  );
}
