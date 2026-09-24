export type IconName = 'device' | 'key' | 'dashboard' | 'logs' | 'plus' | 'menu' | 'appearance' | 'logout' | 'shield' | 'sliders' | 'info' | 'thunderbolt' | 'group';

export const menuGroups = [
  { key: 'monitoring', label: '监控', items: [
    { key: 'dashboard', label: '仪表盘', icon: 'dashboard' as IconName, path: '/dashboard' },
    { key: 'usage-records', label: '使用记录', icon: 'logs' as IconName, path: '/usage-records' },
  ]},
  { key: 'device', label: '设备', items: [
    { key: 'device-groups', label: '模型分组', icon: 'group' as IconName, path: '/device/groups' },
    { key: 'device-agents', label: '设备管理', icon: 'device' as IconName, path: '/device/agents' },
  ]},
  { key: 'caller', label: '调用', items: [
    { key: 'api-keys', label: 'API 密钥', icon: 'key' as IconName, path: '/caller' },
    { key: 'available-channels', label: '可用渠道', icon: 'group' as IconName, path: '/caller/channels' },
    { key: 'caller-statistics', label: '统计', icon: 'dashboard' as IconName },
    { key: 'usage-records', label: '使用记录', icon: 'logs' as IconName },
  ]},
  { key: 'admin', label: '管理员', items: [
    { key: 'system-users', label: '系统用户', icon: 'key' as IconName, path: '/admin/users' },
    { key: 'admin-devices', label: '设备', icon: 'device' as IconName },
    { key: 'admin-statistics', label: '统计', icon: 'dashboard' as IconName },
  ]},
];
