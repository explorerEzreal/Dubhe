import { CalendarOutlined } from '@ant-design/icons';
import { ReloadOutlined } from '@ant-design/icons';
import { Button, DatePicker, Segmented, Typography } from 'antd';
const { Text } = Typography;

import type { ReactNode } from 'react';
import type { Dayjs } from 'dayjs';
import './DateRangeControl.less';

export type DateRangeKey = 'today' | '7d' | '30d' | 'custom';
export type DateRangeOption<T extends string = string> = {
  value: T;
  label: ReactNode;
};

type DateRangeControlProps<TGranularity extends string = string> = {
  value: DateRangeKey;
  customRange: [Dayjs, Dayjs];
  onChange: (value: DateRangeKey) => void;
  onCustomChange: (range: [Dayjs, Dayjs]) => void;
  rangeLabel?: ReactNode;
  rangeOptions?: DateRangeOption<DateRangeKey>[];
  showGranularity?: boolean;
  granularityLabel?: ReactNode;
  granularity?: TGranularity;
  granularityOptions?: DateRangeOption<TGranularity>[];
  onGranularityChange?: (value: TGranularity) => void;
  showAppliedHint?: boolean;
  appliedHint?: ReactNode;
  showRefresh?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  surface?: 'panel' | 'embedded';
  className?: string;
};

const defaultOptions: DateRangeOption<DateRangeKey>[] = [
  { value: 'today', label: '今天' },
  { value: '7d', label: '近 7 天' },
  { value: '30d', label: '近 30 天' },
  { value: 'custom', label: '自定义' },
];

export function DateRangeControl<TGranularity extends string = string>({
  value,
  customRange,
  onChange,
  onCustomChange,
  rangeLabel,
  rangeOptions = defaultOptions,
  showGranularity = false,
  granularityLabel = '粒度',
  granularity,
  granularityOptions = [],
  onGranularityChange,
  showAppliedHint = true,
  appliedHint = '时间范围已应用',
  showRefresh = false,
  refreshing = false,
  onRefresh,
  surface = 'panel',
  className = '',
}: DateRangeControlProps<TGranularity>): JSX.Element {
  return (
    <div className={`common-date-range common-date-range-${surface} ${className}`.trim()}>
      {rangeLabel ? (
        <Text className='common-date-range-label'>{rangeLabel}</Text>
      ) : null}
      <Segmented
        options={rangeOptions}
        value={value}
        onChange={(next) => onChange(next as DateRangeKey)}
      />
      {value === 'custom' ? (
        <DatePicker.RangePicker
          value={customRange}
          allowClear={false}
          onChange={(next) => {
            if (next?.[0] && next[1]) onCustomChange([next[0], next[1]]);
          }}
        />
      ) : showAppliedHint ? (
        <span>
          <CalendarOutlined /> {appliedHint}
        </span>
      ) : null}
      {showGranularity && granularityOptions.length > 0 ? (
        <>
          <span className='common-date-range-granularity-label'>
            {granularityLabel}
          </span>
          <Segmented
            options={granularityOptions}
            value={granularity}
            onChange={(next) => onGranularityChange?.(next as TGranularity)}
          />
        </>
      ) : null}
      {showRefresh && onRefresh ? (
        <Button
          className='common-date-range-refresh'
          icon={<ReloadOutlined />}
          loading={refreshing}
          onClick={onRefresh}
        >
          刷新
        </Button>
      ) : null}
    </div>
  );
}
