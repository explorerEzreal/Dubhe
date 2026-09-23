import type { ReactNode } from 'react';
import type { UsageRecord } from '../../api/usage-api';
import {
  UsageRecordFilters,
  type UsageRecordFilter,
} from '../UsageRecordFilters';
import { UsageRecordTable } from '../UsageRecordTable';

export function UsageRecordExplorer({
  mode = 'records',
  items,
  filters,
  toolbar,
  filterExtra,
  loading,
  error,
  total,
  page,
  pageSize,
  filtered,
  truncated,
  onRetry,
  onReset,
  onRefresh,
  onPageChange,
  onViewAll,
  title,
  description,
}: {
  mode?: 'dashboard' | 'records';
  items: UsageRecord[];
  filters?: UsageRecordFilter[];
  toolbar?: ReactNode;
  filterExtra?: ReactNode;
  loading: boolean;
  error?: boolean;
  total?: number;
  page?: number;
  pageSize?: number;
  filtered?: boolean;
  truncated?: boolean;
  onRetry: () => void;
  onReset?: () => void;
  onRefresh?: () => void;
  onPageChange?: (page: number, pageSize: number) => void;
  onViewAll?: () => void;
  title?: ReactNode;
  description?: ReactNode;
}): JSX.Element {
  return (
    <>
      {filters?.length || toolbar || onRefresh || filterExtra ? (
        <UsageRecordFilters
          filters={filters}
          toolbar={toolbar}
          extra={filterExtra}
          loading={loading}
          onRefresh={onRefresh}
          onReset={onReset}
        />
      ) : null}
      <UsageRecordTable
        mode={mode}
        items={items}
        loading={loading}
        error={error}
        total={total}
        page={page}
        pageSize={pageSize}
        filtered={filtered}
        truncated={truncated}
        onRetry={onRetry}
        onReset={onReset}
        onPageChange={onPageChange}
        onViewAll={onViewAll}
        title={title}
        description={description}
      />
    </>
  );
}
