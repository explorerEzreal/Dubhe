import { useEffect, useState } from 'react';
import { Alert, Button, Form, Input, Modal, Tabs } from 'antd';
import { userApi } from '../api/user-api';
import { useAuthStore } from '../state';

export function AccountSecurityModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { email, nickname, logout, setProfile } = useAuthStore();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setError(''); }, [open]);
  async function saveProfile(values: { email: string; nickname?: string; currentPassword: string }) {
    setSaving(true); setError('');
    try { const result = await userApi.updateProfile({ email: values.email, nickname: values.nickname?.trim() || null, currentPassword: values.currentPassword }); setProfile(result.email, result.nickname ?? null); onClose(); }
    catch { setError('请求失败，请稍后重试'); } finally { setSaving(false); }
  }
  async function savePassword(values: { currentPassword: string; newPassword: string }) {
    setSaving(true); setError('');
    try { await userApi.changeOwnPassword(values); logout(); }
    catch { setError('请求失败，请稍后重试'); } finally { setSaving(false); }
  }
  return <Modal open={open} title='账号与安全' footer={null} onCancel={onClose} destroyOnClose>
    {error && <Alert type='error' message={error} showIcon />}
    <Tabs items={[{ key: 'profile', label: '基本资料', children: <Form layout='vertical' initialValues={{ email, nickname: nickname ?? '' }} onFinish={(v) => void saveProfile(v)}>
      <Form.Item label='昵称' name='nickname'><Input maxLength={50} /></Form.Item><Form.Item label='邮箱' name='email' rules={[{ required: true, type: 'email' }]}><Input /></Form.Item><Form.Item label='当前密码' name='currentPassword' rules={[{ required: true, min: 8 }]}><Input.Password /></Form.Item><Button type='primary' htmlType='submit' loading={saving}>保存资料</Button>
    </Form> }, { key: 'password', label: '修改密码', children: <Form layout='vertical' onFinish={(v) => void savePassword(v)}><Form.Item label='当前密码' name='currentPassword' rules={[{ required: true, min: 8 }]}><Input.Password /></Form.Item><Form.Item label='新密码' name='newPassword' rules={[{ required: true, min: 8 }]}><Input.Password /></Form.Item><Button type='primary' htmlType='submit' loading={saving}>修改密码</Button></Form> }]} />
  </Modal>;
}
