import { useUsageQueryState, useUsageAnalyticsQuery, useUsageRecordsQuery } from '../../features/usage';
import { toMonitoringData } from '../../api/usage-api';
import { ContentLoadingState, ErrorState } from '../../components';
import { UsageRecordFilters } from './UsageRecordFilters';
import { UsageRecordSummary } from './UsageRecordSummary';
import { UsageRecordTable } from './UsageRecordTable';
import { isEmptyFilters } from './record-utils';
import './UsageRecordsPage.less';

export function UsageRecordsPage(): JSX.Element {
  const state = useUsageQueryState({ initialRange: '30d', initialPageSize: 20 });
  const records = useUsageRecordsQuery({ ...state.query, page: state.page, pageSize: state.pageSize, includeFacets: true });
  const summary = useUsageAnalyticsQuery({ ...state.query, granularity: 'day' });
  const { rangeKey, customRange, filters, page, pageSize, updateFilters, updateRange, updateCustomRange, updatePage, resetFilters } = state;

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

      {summary.data ? <UsageRecordSummary data={toMonitoringData(summary.data)} /> : null}

      <div className="ur-card ur-toolbar-card">
        <UsageRecordFilters
          facets={records.facets}
          values={filters}
          rangeKey={rangeKey}
          customRange={customRange}
          loading={records.loading}
          onValuesChange={updateFilters}
          onRangeKeyChange={updateRange}
          onCustomRangeChange={updateCustomRange}
          onReset={resetFilters}
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
                onPageChange={updatePage}
                onReset={resetFilters}
                filtered={filtered}
              />
            )}
      </div>
    </section>
  );
}
