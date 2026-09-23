import type { ReactNode } from 'react';
import { ContentLoadingState, EmptyState, ErrorState } from '../../../components';

export function QueryState({
  loading,
  refreshing,
  error,
  hasData,
  empty = false,
  onRetry,
  children,
}: {
  loading: boolean;
  refreshing?: boolean;
  error: boolean;
  hasData: boolean;
  empty?: boolean;
  onRetry: () => void;
  children: ReactNode;
}): JSX.Element {
  if (loading && !hasData) return <ContentLoadingState />;
  if (error && !hasData) return <ErrorState onRetry={onRetry} />;
  if (empty && hasData) return <EmptyState description='该时间范围内没有调用记录' />;
  return <div className={refreshing ? 'usage-query-refreshing' : undefined}>{children}</div>;
}
