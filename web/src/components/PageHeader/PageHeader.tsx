import { ReloadOutlined } from '@ant-design/icons';
import { Button, Typography } from 'antd';
import type { ReactNode } from 'react';
import './PageHeader.less';

type PageHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  loading?: boolean;
  onRefresh?: () => void;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ title, subtitle, meta, loading = false, onRefresh, actions, className = '' }: PageHeaderProps): JSX.Element {
  return (
    <header className={`common-page-head ${className}`.trim()}>
      <div>
        <Typography.Title level={1}>{title}</Typography.Title>
        {subtitle ? <p className="common-page-subtitle">{subtitle}</p> : null}
        {meta ? <div className="common-page-meta">{meta}</div> : null}
      </div>
      {actions ?? (onRefresh ? <Button icon={<ReloadOutlined />} loading={loading} onClick={onRefresh}>刷新</Button> : null)}
    </header>
  );
}
