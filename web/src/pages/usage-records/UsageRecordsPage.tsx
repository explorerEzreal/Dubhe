import { useMemo } from 'react';
import {
  DateRangeControl,
  PageHeader,
  UsageRecordExplorer,
  type UsageRecordFilter,
} from '../../components';
import { toMonitoringData } from '../../api/usage-api';
import {
  useUsageAnalyticsQuery,
  useUsageQueryState,
  useUsageRecordsQuery,
} from '../../features/usage';
import { isEmptyFilters, statusMeta } from './record-utils';
import { UsageRecordSummary } from './UsageRecordSummary';
import './UsageRecordsPage.less';

export function UsageRecordsPage(): JSX.Element {
  const state = useUsageQueryState({
    initialRange: '30d',
    initialPageSize: 20,
  });
  const records = useUsageRecordsQuery(
    {
      ...state.query,
      page: state.page,
      pageSize: state.pageSize,
      includeFacets: true,
    },
    { poll: true },
  );
  const summary = useUsageAnalyticsQuery(
    {
      ...state.query,
      granularity: 'day',
    },
    { poll: true },
  );
  const {
    rangeKey,
    customRange,
    filters,
    page,
    pageSize,
    updateFilters,
    updateRange,
    updateCustomRange,
    updatePage,
    resetFilters,
  } = state;
  const filtered = !isEmptyFilters(filters);
  const handleRefresh = async (): Promise<void> => {
    await Promise.all([records.reload(), summary.reload()]);
  };

  const filterFields = useMemo<UsageRecordFilter[]>(
    () => [
      {
        key: 'status',
        label: '状态',
        value: filters.status,
        options: (records.facets?.statuses ?? []).map((value) => ({
          label: statusMeta(value).label,
          value,
        })),
        onChange: (status) => updateFilters({ ...filters, status }),
      },
      {
        key: 'modelId',
        label: '模型',
        value: filters.modelId,
        searchable: true,
        options: (records.facets?.models ?? []).map((item) => ({
          label: item.name,
          value: item.id,
        })),
        onChange: (modelId) => updateFilters({ ...filters, modelId }),
      },
      {
        key: 'groupId',
        label: '分组',
        value: filters.groupId,
        searchable: true,
        options: (records.facets?.groups ?? []).map((item) => ({
          label: item.deleted ? `${item.name}（已停用）` : item.name,
          value: item.id,
        })),
        onChange: (groupId) => updateFilters({ ...filters, groupId }),
      },
      {
        key: 'deviceId',
        label: '设备',
        value: filters.deviceId,
        searchable: true,
        options: (records.facets?.devices ?? []).map((item) => ({
          label: item.name,
          value: item.id,
        })),
        onChange: (deviceId) => updateFilters({ ...filters, deviceId }),
      },
      {
        key: 'userId',
        label: '用户',
        value: filters.userId,
        searchable: true,
        options: (records.facets?.users ?? []).map((item) => ({
          label: item.name,
          value: item.id,
        })),
        onChange: (userId) => updateFilters({ ...filters, userId }),
      },
    ],
    [filters, records.facets, updateFilters],
  );

  return (
    <section className='usage-records-page'>
      <PageHeader
        title='使用记录'
        meta={
          <>
            <span className='status-dot' />
            数据更新于{' '}
            <span className='mono'>
              {summary.data?.generatedAt
                ? new Date(summary.data.generatedAt).toLocaleString()
                : '—'}
            </span>
            <span>·</span>
            <span>每 15 秒自动刷新</span>
          </>
        }
        className='usage-records-head'
      />
      <DateRangeControl
        value={rangeKey}
        customRange={customRange}
        onChange={updateRange}
        onCustomChange={updateCustomRange}
        showAppliedHint
        showRefresh
        rangeLabel='时间范围'
        refreshing={records.loading || summary.loading}
        onRefresh={() => void handleRefresh()}
        className='usage-date-range'
      />
      {summary.data ? (
        <UsageRecordSummary data={toMonitoringData(summary.data)} />
      ) : null}
      <UsageRecordExplorer
        mode='records'
        items={records.data?.items ?? []}
        filters={filterFields}
        loading={records.loading}
        error={Boolean(records.error)}
        total={records.data?.total ?? 0}
        page={page}
        pageSize={records.data?.pageSize ?? pageSize}
        filtered={filtered}
        onRetry={() => void records.reload()}
        onReset={resetFilters}
        onPageChange={updatePage}
        title='使用记录'
        description='用户历史记录'
      />
    </section>
  );
}
