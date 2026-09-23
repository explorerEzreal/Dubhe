import { CloseOutlined, FilterOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button, Select } from 'antd';
import type { ReactNode } from 'react';
import './UsageRecordFilters.less';

export type UsageRecordFilter = {
  key: string;
  label: ReactNode;
  value?: string;
  options: Array<{ label: ReactNode; value: string }>;
  searchable?: boolean;
  allowClear?: boolean;
  onChange: (value?: string) => void;
};

export function UsageRecordFilters({
  filters, toolbar, loading = false, onRefresh, onReset, extra,
}: {
  filters?: UsageRecordFilter[];
  toolbar?: ReactNode;
  loading?: boolean;
  onRefresh?: () => void;
  onReset?: () => void;
  extra?: ReactNode;
}): JSX.Element {
  const active = (filters ?? []).filter((filter) => filter.value);
  return <div className="usage-record-filters">
    <div className="usage-filter-row">{toolbar ? <div className="usage-filter-toolbar-slot">{toolbar}</div> : null}{!toolbar ? <span className="usage-filter-spacer" /> : null}{onRefresh ? <Button icon={<ReloadOutlined />} loading={loading} onClick={onRefresh}>刷新</Button> : null}</div>
    {filters?.length ? <div className="usage-filter-row usage-filter-fields">
      {filters.map((filter) => <label className="usage-filter-field" key={filter.key}><span>{filter.label}</span><Select allowClear={filter.allowClear ?? true} showSearch={filter.searchable} optionFilterProp="label" placeholder={`全部${String(filter.label)}`} value={filter.value} options={filter.options} onChange={filter.onChange} /></label>)}
      <span className="usage-filter-spacer" />{active.length && onReset ? <Button type="link" size="small" icon={<FilterOutlined />} onClick={onReset}>清空筛选</Button> : null}{extra}
    </div> : null}
    {active.length ? <div className="usage-filter-row"><div className="usage-filter-chips">{active.map((filter) => <span className="usage-filter-chip" key={filter.key}><em>{filter.label}</em>{filter.options.find((option) => option.value === filter.value)?.label ?? filter.value}<button type="button" aria-label={`清除${String(filter.label)}筛选`} onClick={() => filter.onChange(undefined)}><CloseOutlined /></button></span>)}</div></div> : null}
  </div>;
}
