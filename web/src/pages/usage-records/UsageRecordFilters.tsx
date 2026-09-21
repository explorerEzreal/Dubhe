import { CloseOutlined, FilterOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button, DatePicker, Segmented, Select } from 'antd';
import type { Dayjs } from 'dayjs';
import type { UsageRecordFacets } from '../../api/usage-api';
import { statusMeta, type RangeKey, type RecordFilters } from './record-utils';

type Props = {
  facets: UsageRecordFacets | null;
  values: RecordFilters;
  rangeKey: RangeKey;
  customRange: [Dayjs, Dayjs];
  loading: boolean;
  onValuesChange: (values: RecordFilters) => void;
  onRangeKeyChange: (key: RangeKey) => void;
  onCustomRangeChange: (range: [Dayjs, Dayjs]) => void;
  onReset: () => void;
  onRefresh: () => void;
};

const FIELD_WIDTH = { minWidth: 158 };

export function UsageRecordFilters({
  facets, values, rangeKey, customRange, loading,
  onValuesChange, onRangeKeyChange, onCustomRangeChange, onReset, onRefresh,
}: Props): JSX.Element {
  const chips: Array<{ key: keyof RecordFilters; label: string; text: string }> = [];
  if (values.status) chips.push({ key: 'status', label: '状态', text: statusMeta(values.status).label });
  if (values.modelId) chips.push({ key: 'modelId', label: '模型', text: facets?.models.find((item) => item.id === values.modelId)?.name ?? values.modelId });
  if (values.groupId) chips.push({ key: 'groupId', label: '分组', text: facets?.groups.find((item) => item.id === values.groupId)?.name ?? values.groupId });
  if (values.deviceId) chips.push({ key: 'deviceId', label: '设备', text: facets?.devices.find((item) => item.id === values.deviceId)?.name ?? values.deviceId });
  if (values.userId) chips.push({ key: 'userId', label: '用户', text: facets?.users?.find((item) => item.id === values.userId)?.name ?? values.userId });

  return (
    <div className="ur-toolbar">
      <div className="ur-toolbar-row">
        <Segmented
          value={rangeKey}
          onChange={(value) => onRangeKeyChange(value as RangeKey)}
          options={[
            { label: '今天', value: 'today' },
            { label: '近 7 天', value: '7d' },
            { label: '近 30 天', value: '30d' },
            { label: '自定义', value: 'custom' },
          ]}
        />
        <DatePicker.RangePicker
          value={customRange}
          allowClear={false}
          disabled={rangeKey !== 'custom'}
          onChange={(value) => { if (value?.[0] && value?.[1]) onCustomRangeChange([value[0], value[1]]); }}
        />
        <span className="ur-spacer" />
        <Button icon={<ReloadOutlined />} loading={loading} onClick={onRefresh}>刷新</Button>
      </div>

      <div className="ur-toolbar-row">
        <label className="ur-field">
          <span>状态</span>
          <Select
            allowClear
            style={FIELD_WIDTH}
            placeholder="全部状态"
            value={values.status}
            options={(facets?.statuses ?? []).map((value) => ({ label: statusMeta(value).label, value }))}
            onChange={(status) => onValuesChange({ ...values, status })}
          />
        </label>
        <label className="ur-field">
          <span>模型</span>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            style={FIELD_WIDTH}
            placeholder="全部模型"
            value={values.modelId}
            options={(facets?.models ?? []).map((item) => ({ label: item.name, value: item.id }))}
            onChange={(modelId) => onValuesChange({ ...values, modelId })}
          />
        </label>
        <label className="ur-field">
          <span>分组</span>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            style={FIELD_WIDTH}
            placeholder="全部分组"
            value={values.groupId}
            options={(facets?.groups ?? []).map((item) => ({ label: item.deleted ? `${item.name}（已停用）` : item.name, value: item.id }))}
            onChange={(groupId) => onValuesChange({ ...values, groupId })}
          />
        </label>
        <label className="ur-field">
          <span>设备</span>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            style={FIELD_WIDTH}
            placeholder="全部设备"
            value={values.deviceId}
            options={(facets?.devices ?? []).map((item) => ({ label: item.name, value: item.id }))}
            onChange={(deviceId) => onValuesChange({ ...values, deviceId })}
          />
        </label>
        <label className="ur-field">
          <span>用户</span>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            style={FIELD_WIDTH}
            placeholder="全部用户"
            value={values.userId}
            options={(facets?.users ?? []).map((item) => ({ label: item.name, value: item.id }))}
            onChange={(userId) => onValuesChange({ ...values, userId })}
          />
        </label>
        <span className="ur-spacer" />
        {chips.length > 0 && (
          <Button type="link" size="small" icon={<FilterOutlined />} onClick={onReset}>清空筛选</Button>
        )}
      </div>

      {chips.length > 0 && (
        <div className="ur-toolbar-row">
          <div className="ur-chips">
            {chips.map((chip) => (
              <span key={chip.key} className="ur-chip">
                <em>{chip.label}</em>
                {chip.text}
                <button type="button" aria-label={`清除${chip.label}筛选`} onClick={() => onValuesChange({ ...values, [chip.key]: undefined } as RecordFilters)}>
                  <CloseOutlined />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
