import { Alert, Empty, Skeleton, Spin } from 'antd';
import { REQUEST_ERROR_MESSAGE } from '../constants';

export function LoadingState({ text = '加载中...' }: { text?: string }) {
  return <div className="state-view"><Spin tip={text} /></div>;
}

export function EmptyState({ description }: { description: string }) {
  return <Empty description={description} />;
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return <Alert type="error" showIcon message={REQUEST_ERROR_MESSAGE} action={onRetry ? <button className="link-button" onClick={onRetry}>重试</button> : undefined} />;
}

export function ContentLoadingState() {
  return <div className="state-view"><Skeleton active paragraph={{ rows: 4 }} /></div>;
}
