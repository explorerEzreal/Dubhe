import { CalendarOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { DatePicker, Segmented } from 'antd';
import type { Dayjs } from 'dayjs';
import './DashboardToolbar.less';

type Range = 'today' | '7d' | '30d' | 'custom';
export function DashboardToolbar({ range, customRange, granularity, pointCount, onRangeChange, onCustomRangeChange, onGranularityChange }: { range: Range; customRange: [Dayjs, Dayjs]; granularity: 'hour' | 'day'; pointCount: number; onRangeChange: (value: Range) => void; onCustomRangeChange: (value: [Dayjs, Dayjs]) => void; onGranularityChange: (value: 'hour' | 'day') => void }): JSX.Element {
  const labels = { today: '今日', '7d': '近 7 天', '30d': '近 30 天', custom: '自定义' };
  return <div className='design-toolbar'><span className='toolbar-label'>时间范围</span><Segmented options={Object.entries(labels).map(([value, label]) => ({ value, label }))} value={range} onChange={(value) => onRangeChange(value as Range)} />{range === 'custom' ? <DatePicker.RangePicker className='toolbar-picker-input' value={customRange} onChange={(value) => { if (value?.[0] && value?.[1]) onCustomRangeChange([value[0], value[1]]); }} /> : <button className='toolbar-picker'><CalendarOutlined />时间范围已应用</button>}<span className='toolbar-label'>粒度</span><Segmented options={[{ value: 'hour', label: '按小时' }, { value: 'day', label: '按天' }]} value={granularity} onChange={(value) => onGranularityChange(value as 'hour' | 'day')} /><div className='toolbar-updated'><ClockCircleOutlined />共 <b className='mono'>{pointCount}</b> 个数据点</div></div>;
}
