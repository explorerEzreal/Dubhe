import type { ReactNode } from 'react';
import { App as AntApp, ConfigProvider } from 'antd';

export function AppProviders({ children }: { children: ReactNode }) {
  return <ConfigProvider theme={{ token: { colorPrimary: '#1677ff', borderRadius: 8 } }}><AntApp>{children}</AntApp></ConfigProvider>;
}
