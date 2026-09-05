import { Alert, Empty, Spin } from 'antd';

export function LoadingState({ text = '加载中...' }: { text?: string }) {
  return <div className="state-view"><Spin tip={text} /></div>;
}

export function EmptyState({ description }: { description: string }) {
  return <Empty description={description} />;
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return <Alert type="error" showIcon message="请求失败，请稍后重试" action={onRetry ? <button className="link-button" onClick={onRetry}>重试</button> : undefined} />;
}
