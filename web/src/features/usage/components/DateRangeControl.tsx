import { CalendarOutlined } from '@ant-design/icons';
import { DatePicker, Segmented } from 'antd';
import type { Dayjs } from 'dayjs';
import type { UsageRangeKey } from '../hooks';

export function DateRangeControl({
  value,
  customRange,
  onChange,
  onCustomChange,
}: {
  value: UsageRangeKey;
  customRange: [Dayjs, Dayjs];
  onChange: (value: UsageRangeKey) => void;
  onCustomChange: (value: [Dayjs, Dayjs]) => void;
}): JSX.Element {
  return <>
    <Segmented
      value={value}
      onChange={(next) => onChange(next as UsageRangeKey)}
      options={[{ label: '今天', value: 'today' }, { label: '近 7 天', value: '7d' }, { label: '近 30 天', value: '30d' }, { label: '自定义', value: 'custom' }]}
    />
    {value === 'custom' ? <DatePicker.RangePicker value={customRange} allowClear={false} onChange={(next) => { if (next?.[0] && next[1]) onCustomChange([next[0], next[1]]); }} /> : <span><CalendarOutlined /> 时间范围已应用</span>}
  </>;
}
