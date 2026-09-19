export const REQUEST_ERROR_MESSAGE = '请求失败，请稍后重试';
export const DASHBOARD_POLL_INTERVAL = 15_000;
export const THEME_STORAGE_KEY = 'shibawork_theme';
export const DEFAULT_DEVICE_NAME = 'Bubhe Agent-001';
export const DEFAULT_LOCAL_MODEL_HOST = '127.0.0.1';
export const DEFAULT_LOCAL_MODEL_PORT = '8080';

export const AGENT_STATUS_TEXT: Record<string, string> = {
  created: '未安装', connecting: '连接中', online: '在线', degraded: '降级', offline: '离线', revoked: '已撤销',
};

export const MODEL_STATE_TEXT: Record<string, string> = {
  unknown: '未知', checking: '检查中', pulling: '拉取中', ready: '就绪', busy: '忙碌', error: '错误', stopped: '已停止', offline: '离线',
};

export const AGENT_STATUS_REASON_TEXT: Record<string, string> = {
  heartbeat: '心跳正常',
  heartbeat_timeout: '心跳超时',
  model_unavailable: '模型不可用',
  credential_revoked: '凭证已撤销',
  not_registered: '尚未注册',
};

export function statusColor(status: string): string {
  if (status === 'online' || status === 'ready') return 'green';
  if (['degraded', 'pulling', 'checking', 'busy'].includes(status)) return 'orange';
  if (status === 'error' || status === 'revoked') return 'red';
  return 'default';
}
