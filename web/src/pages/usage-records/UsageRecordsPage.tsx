import dayjs, { type Dayjs } from 'dayjs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usageApi, type UsageRecordFacets } from '../../api/usage-api';
import { ContentLoadingState, ErrorState } from '../../components';
import { useAsyncList } from '../../hooks';
import { UsageRecordFilters } from './UsageRecordFilters';
import { UsageRecordSummary } from './UsageRecordSummary';
import { UsageRecordTable } from './UsageRecordTable';
import { isEmptyFilters, mergeFacets, type RangeKey, type RecordFilters } from './record-utils';
import './UsageRecordsPage.less';

function rangeDates(key: RangeKey, custom: [Dayjs, Dayjs]): [Dayjs, Dayjs] {
  const end = dayjs();
  if (key === 'today') return [end.startOf('day'), end];
  if (key === '7d') return [end.subtract(6, 'day').startOf('day'), end];
  if (key === '30d') return [end.subtract(29, 'day').startOf('day'), end];
  return custom;
}

export function UsageRecordsPage(): JSX.Element {
  const [rangeKey, setRangeKey] = useState<RangeKey>('30d');
  const [customRange, setCustomRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(29, 'day'), dayjs()]);
  const [filters, setFilters] = useState<RecordFilters>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [facets, setFacets] = useState<UsageRecordFacets | null>(null);

  const [from, to] = rangeDates(rangeKey, customRange);
  const fromIso = from.startOf('day').toISOString();
  const toIso = to.endOf('day').toISOString();

  const query = useMemo(() => ({
    status: filters.status ? [filters.status] : undefined,
    modelIds: filters.modelId ? [filters.modelId] : undefined,
    groupIds: filters.groupId ? [filters.groupId] : undefined,
    deviceIds: filters.deviceId ? [filters.deviceId] : undefined,
    userIds: filters.userId ? [filters.userId] : undefined,
  }), [filters]);

  const loadRecords = useCallback(
    () => usageApi.records({ page, pageSize, from: fromIso, to: toIso, include: true, ...query }),
    [page, pageSize, fromIso, toIso, query],
  );
  const records = useAsyncList(loadRecords);

  const loadSummary = useCallback(
    () => usageApi.analytics({ from: fromIso, to: toIso, granularity: 'day', ...query }),
    [fromIso, toIso, query],
  );
  const summary = useAsyncList(loadSummary);

  const recordsFirstLoad = useRef(true);
  useEffect(() => {
    if (recordsFirstLoad.current) { recordsFirstLoad.current = false; return; }
    records.reload();
  }, [loadRecords, records.reload]);

  const summaryFirstLoad = useRef(true);
  useEffect(() => {
    if (summaryFirstLoad.current) { summaryFirstLoad.current = false; return; }
    summary.reload();
  }, [loadSummary, summary.reload]);

  // facets 只增不减，避免翻页后筛选项被清空
  useEffect(() => {
    if (records.data?.facets) {
      const next = records.data.facets;
      setFacets((previous) => mergeFacets(previous, next));
    }
  }, [records.data]);

  const handleValuesChange = useCallback((next: RecordFilters) => { setFilters(next); setPage(1); }, []);
  const handleRangeKeyChange = useCallback((key: RangeKey) => { setRangeKey(key); setPage(1); }, []);
  const handleCustomRangeChange = useCallback((range: [Dayjs, Dayjs]) => { setCustomRange(range); setRangeKey('custom'); setPage(1); }, []);
  const handleReset = useCallback(() => { setFilters({}); setPage(1); }, []);
  const handlePageChange = useCallback((nextPage: number, nextSize: number) => { setPage(nextPage); setPageSize(nextSize); }, []);

  const hasData = Boolean(records.data);
  const filtered = !isEmptyFilters(filters);

  return (
    <section className="usage-records-page">
      <header className="ur-head">
        <div>
          <h1 className="ur-title">使用记录</h1>
          <p className="ur-subtitle">按时间查看每一次请求的模型、Token 与延迟明细。</p>
        </div>
      </header>

      {summary.data ? <UsageRecordSummary data={summary.data} /> : null}

      <div className="ur-card ur-toolbar-card">
        <UsageRecordFilters
          facets={facets}
          values={filters}
          rangeKey={rangeKey}
          customRange={customRange}
          loading={records.loading}
          onValuesChange={handleValuesChange}
          onRangeKeyChange={handleRangeKeyChange}
          onCustomRangeChange={handleCustomRangeChange}
          onReset={handleReset}
          onRefresh={() => void records.reload()}
        />
      </div>

      <div className="ur-card ur-table-card">
        <div className="ur-table-head">
          <strong>请求明细</strong>
          <span>左右两侧列已固定，中间字段可横向滚动；悬停时间可查看 Request ID</span>
        </div>
        {records.error && !hasData
          ? <div className="ur-state"><ErrorState onRetry={() => void records.reload()} /></div>
          : !hasData && records.loading
            ? <ContentLoadingState />
            : (
              <UsageRecordTable
                items={records.data?.items ?? []}
                loading={records.loading}
                total={records.data?.total ?? 0}
                page={page}
                pageSize={records.data?.pageSize ?? pageSize}
                onPageChange={handlePageChange}
                onReset={handleReset}
                filtered={filtered}
              />
            )}
      </div>
    </section>
  );
}
