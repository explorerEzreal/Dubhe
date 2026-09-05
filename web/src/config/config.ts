const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export const config = {
  apiBaseUrl: API_BASE_URL,
  cloudWebSocketUrl: API_BASE_URL.replace(/^http/, 'ws').replace(/\/$/, '') + '/agent',
  agentInstallScriptUrl: API_BASE_URL.replace(/\/$/, '') + '/downloads/agent/install.sh',
} as const;
