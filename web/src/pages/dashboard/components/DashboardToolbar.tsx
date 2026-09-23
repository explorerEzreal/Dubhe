import { ClockCircleOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import { DateRangeControl, type DateRangeKey } from '../../../components';
import './DashboardToolbar.less';

export function DashboardToolbar({
  range,
  customRange,
  granularity,
  pointCount,
  onRangeChange,
  onCustomRangeChange,
  onGranularityChange,
}: {
  range: DateRangeKey;
  customRange: [Dayjs, Dayjs];
  granularity: 'hour' | 'day';
  pointCount: number;
  onRangeChange: (value: DateRangeKey) => void;
  onCustomRangeChange: (value: [Dayjs, Dayjs]) => void;
  onGranularityChange: (value: 'hour' | 'day') => void;
}): JSX.Element {
  return (
    <DateRangeControl
      value={range}
      customRange={customRange}
      onChange={onRangeChange}
      onCustomChange={onCustomRangeChange}
      rangeLabel='时间范围'
      rangeOptions={[
        { value: 'today', label: '今日' },
        { value: '7d', label: '近 7 天' },
        { value: '30d', label: '近 30 天' },
        { value: 'custom', label: '自定义' },
      ]}
      showAppliedHint
      appliedHint='时间范围已应用'
      showGranularity
      granularityLabel='粒度'
      granularity={granularity}
      granularityOptions={[
        { value: 'hour', label: '按小时' },
        { value: 'day', label: '按天' },
      ]}
      onGranularityChange={onGranularityChange}
      // surface='embedded'
      className='dashboard-range'
    />
  );
}
