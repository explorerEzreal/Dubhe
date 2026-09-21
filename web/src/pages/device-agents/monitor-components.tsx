import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useEffect, useState, type KeyboardEvent } from 'react';
import { Button, Card, Dropdown, Input, Progress, Tag, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import {
  SearchOutlined,
  AppstoreOutlined,
  HddOutlined,
  ClusterOutlined,
  WifiOutlined,
  CheckOutlined,
  CloseOutlined,
  CopyOutlined,
  EditOutlined,
  MoreOutlined,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons';
import type { AgentSummary } from '../../api/agent-api';
import type { GroupSummary } from '../../api/group-api';
import { useChartTheme, useStatusTone } from '../../hooks/useChartTheme';
import {
  AGENT_STATUS_TEXT,
  MODEL_STATE_TEXT,
  statusColor,
} from '../../constants';

export type DeviceStatusFilter =
  | 'all'
  | 'created'
  | 'connecting'
  | 'online'
  | 'degraded'
  | 'offline'
  | 'revoked';

/** 合法设备状态集合，用于运行时校验；颜色统一由 useStatusTone() 提供 */
const DEVICE_STATUSES: readonly string[] = [
  'created',
  'connecting',
  'online',
  'degraded',
  'offline',
  'revoked',
];

function statusOf(agent: AgentSummary): DeviceStatusFilter {
  return DEVICE_STATUSES.includes(agent.status)
    ? (agent.status as DeviceStatusFilter)
    : 'offline';
}

function metricNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function memoryUsage(agent: AgentSummary): number | null {
  const memory = agent.hardwareInfo?.memory as
    | { totalBytes?: unknown; freeBytes?: unknown; usagePercent?: unknown }
    | undefined;
  const reported = metricNumber(memory?.usagePercent);
  if (reported !== null && reported >= 0 && reported <= 100)
    return Math.round(reported);
  const total = metricNumber(memory?.totalBytes);
  const free = metricNumber(memory?.freeBytes);
  if (!total || free === null || free > total) return null;
  return Math.round(((total - free) / total) * 100);
}

function loadUsage(agent: AgentSummary): number | null {
  const cpu = agent.hardwareInfo?.cpu as
    | { loadAverage?: unknown; cores?: unknown; usagePercent?: unknown }
    | undefined;
  const reported = metricNumber(cpu?.usagePercent);
  if (reported !== null && reported >= 0 && reported <= 100)
    return Math.round(reported);
  const load = Array.isArray(cpu?.loadAverage)
    ? metricNumber(cpu.loadAverage[0])
    : null;
  const cores = metricNumber(cpu?.cores);
  if (load === null || !cores) return null;
  return Math.min(100, Math.round((load / cores) * 100));
}

function nestedUsage(agent: AgentSummary, key: 'gpu' | 'disk'): number | null {
  const resource = agent.hardwareInfo?.[key] as
    | { usagePercent?: unknown }
    | undefined;
  const value = metricNumber(resource?.usagePercent);
  return value !== null && value >= 0 && value <= 100
    ? Math.round(value)
    : null;
}

function networkLabel(agent: AgentSummary): string {
  const network = agent.hardwareInfo?.network as
    | { rxBytesPerSecond?: unknown; txBytesPerSecond?: unknown }
    | undefined;
  const rx = metricNumber(network?.rxBytesPerSecond);
  const tx = metricNumber(network?.txBytesPerSecond);
  if (rx === null && tx === null) return '暂无数据';
  const format = (value: number | null) =>
    value === null ? '—' : `${Math.round(value / 1024)} KB/s`;
  return `收 ${format(rx)} · 发 ${format(tx)}`;
}

export function GroupRail({
  groups,
  selected,
  agents,
  onSelect,
}: {
  groups: GroupSummary[];
  selected: string;
  agents: AgentSummary[];
  onSelect: (id: string) => void;
}) {
  const items = [
    { id: 'all', name: '全部设备', agentCount: agents.length },
    ...groups,
  ];
  return (
    <section className='device-group-section'>
      <div className='device-group-title'>设备分组</div>
      <div className='device-group-rail'>
        {items.map((group, index) => (
          <button
            className={`device-group-item${selected === group.id ? ' is-selected' : ''}`}
            key={group.id}
            onClick={() => onSelect(group.id)}
          >
            <span className='device-group-icon'>
              {index === 0 ? <AppstoreOutlined /> : <ClusterOutlined />}
            </span>
            <span className='device-group-name'>{group.name}</span>
            <span className='device-group-count'>{group.agentCount}</span>
            <span className='device-group-bar'>
              <i
                style={{
                  width: `${Math.min(100, Math.max(12, group.agentCount * 20))}%`,
                }}
              />
            </span>
          </button>
        ))}
        {!groups.length && (
          <div className='device-group-empty'>暂无已创建分组</div>
        )}
      </div>
    </section>
  );
}

export function StatusFilters({
  value,
  onChange,
  search,
  onSearch,
}: {
  value: DeviceStatusFilter;
  onChange: (value: DeviceStatusFilter) => void;
  search: string;
  onSearch: (value: string) => void;
}) {
  const statusTone = useStatusTone();
  const filters: Array<[DeviceStatusFilter, string]> = [
    ['all', '全部状态'],
    ['online', '在线'],
    ['created', '未安装'],
    ['connecting', '连接中'],
    ['degraded', '降级'],
    ['offline', '离线'],
    ['revoked', '已撤销'],
  ];
  return (
    <div className='device-toolbar'>
      <div className='device-filter-group'>
        {filters.map(([key, label]) => (
          <Button
            key={key}
            className={value === key ? 'is-active' : ''}
            onClick={() => onChange(key)}
          >
            <span
              className='status-dot'
              style={{ background: statusTone[key] }}
            />
            {label}
          </Button>
        ))}
      </div>
      <Input
        allowClear
        prefix={<SearchOutlined />}
        value={search}
        onChange={(event) => onSearch(event.target.value)}
        placeholder='搜索设备名称或 IP'
      />
    </div>
  );
}

export function OverviewCards({ agents }: { agents: AgentSummary[] }) {
  const statusTone = useStatusTone();
  const chart = useChartTheme();
  const counts = agents.reduce(
    (result, agent) => {
      result[statusOf(agent)] += 1;
      return result;
    },
    {
      all: agents.length,
      created: 0,
      connecting: 0,
      online: 0,
      degraded: 0,
      offline: 0,
      revoked: 0,
    } as Record<DeviceStatusFilter, number>,
  );
  const averageMemory = agents
    .map(memoryUsage)
    .filter((value): value is number => value !== null);
  const averageCpu = agents
    .map(loadUsage)
    .filter((value): value is number => value !== null);
  const statusOption: EChartsOption = {
    tooltip: {
      trigger: 'item',
      backgroundColor: chart.tooltipBg,
      borderColor: chart.tooltipBorder,
      textStyle: { color: chart.tooltipText },
    },
    series: [
      {
        type: 'pie',
        radius: ['58%', '78%'],
        avoidLabelOverlap: true,
        label: { show: false },
        data: [
          {
            value: counts.online,
            name: '在线',
            itemStyle: { color: statusTone.online },
          },
          {
            value: counts.connecting,
            name: '连接中',
            itemStyle: { color: statusTone.connecting },
          },
          {
            value: counts.degraded,
            name: '降级',
            itemStyle: { color: statusTone.degraded },
          },
          {
            value: counts.offline,
            name: '离线',
            itemStyle: { color: statusTone.offline },
          },
          {
            value: counts.created,
            name: '未安装',
            itemStyle: { color: statusTone.created },
          },
          {
            value: counts.revoked,
            name: '已撤销',
            itemStyle: { color: statusTone.revoked },
          },
        ],
      },
    ],
  };
  const resourceOption: EChartsOption = {
    tooltip: {
      trigger: 'item',
      backgroundColor: chart.tooltipBg,
      borderColor: chart.tooltipBorder,
      textStyle: { color: chart.tooltipText },
    },
    series: [
      {
        type: 'pie',
        radius: ['58%', '78%'],
        center: ['27%', '50%'],
        label: {
          show: true,
          position: 'center',
          formatter: `${averageCpu.length ? Math.round(averageCpu.reduce((a, b) => a + b, 0) / averageCpu.length) : 0}%`,
          color: chart.text,
          fontSize: 16,
        },
        data: [
          {
            value: averageCpu.length
              ? Math.round(
                  averageCpu.reduce((a, b) => a + b, 0) / averageCpu.length,
                )
              : 0,
            itemStyle: { color: chart.palette[0] },
          },
          { value: 100, itemStyle: { color: chart.splitLine } },
        ],
      },
      {
        type: 'pie',
        radius: ['58%', '78%'],
        center: ['73%', '50%'],
        label: {
          show: true,
          position: 'center',
          formatter: `${averageMemory.length ? Math.round(averageMemory.reduce((a, b) => a + b, 0) / averageMemory.length) : 0}%`,
          color: chart.text,
          fontSize: 16,
        },
        data: [
          {
            value: averageMemory.length
              ? Math.round(
                  averageMemory.reduce((a, b) => a + b, 0) /
                    averageMemory.length,
                )
              : 0,
            itemStyle: { color: chart.palette[0] },
          },
          { value: 100, itemStyle: { color: chart.splitLine } },
        ],
      },
    ],
  };
  const trendOption: EChartsOption = {
    grid: { left: 4, right: 4, top: 10, bottom: 4 },
    xAxis: {
      type: 'category',
      show: false,
      data: ['-5', '-4', '-3', '-2', '-1', 'now'],
    },
    yAxis: { type: 'value', show: false },
    series: [
      {
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: [],
        lineStyle: { color: chart.palette[0], width: 2 },
        areaStyle: { color: `${chart.palette[0]}29` },
      },
    ],
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: 'middle',
        style: {
          text: '暂无网络历史数据',
          fill: chart.axisLabel,
          fontSize: 12,
        },
      },
    ],
  };
  return (
    <div className='device-overview-grid'>
      <Card className='device-summary-card'>
        <div className='summary-number'>{agents.length}</div>
        <div className='summary-label'>设备总数</div>
        <div className='summary-status-row'>
          <span>
            <i
              className='status-dot'
              style={{ background: statusTone.online }}
            />
            在线 {counts.online}
          </span>
          <span>
            <i
              className='status-dot'
              style={{ background: statusTone.degraded }}
            />
            降级 {counts.degraded}
          </span>
          <span>
            <i
              className='status-dot'
              style={{ background: statusTone.offline }}
            />
            离线 {counts.offline}
          </span>
        </div>
      </Card>
      <Card title='状态分布' className='device-chart-card'>
        <ReactECharts
          option={statusOption}
          style={{ height: 130 }}
          opts={{ renderer: 'svg' }}
        />
        <div className='chart-legend'>
          {(['online', 'degraded', 'offline'] as DeviceStatusFilter[]).map(
            (key) => (
              <span key={key}>
                <i
                  className='status-dot'
                  style={{ background: statusTone[key] }}
                />
                {AGENT_STATUS_TEXT[key]} {counts[key]}
              </span>
            ),
          )}
        </div>
      </Card>
      <Card title='平均资源占用' className='device-chart-card'>
        <ReactECharts
          option={resourceOption}
          style={{ height: 130 }}
          opts={{ renderer: 'svg' }}
        />
        <div className='resource-labels'>
          <span>CPU</span>
          <span>内存</span>
        </div>
      </Card>
      <Card
        title={
          <>
            <WifiOutlined /> 网络吞吐（实时）
          </>
        }
        className='device-chart-card network-card'
      >
        <div className='network-empty'>暂无网络历史数据</div>
        <ReactECharts
          option={trendOption}
          style={{ height: 78 }}
          opts={{ renderer: 'svg' }}
        />
      </Card>
    </div>
  );
}

export function DeviceMonitorCard({
  agent,
  usage,
  operating,
  onCopyName,
  onCopyModel,
  onCopyId,
  onRename,
  onRotate,
  onRevoke,
}: {
  agent: AgentSummary;
  usage?: { totalCalls: number; totalTokens: number };
  operating: boolean;
  onCopyName: () => Promise<boolean>;
  onCopyModel: (model: string) => Promise<boolean>;
  onCopyId: () => void;
  onRename: (name: string) => Promise<boolean>;
  onRotate: () => void;
  onRevoke: () => void;
}) {
  const statusTone = useStatusTone();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(agent.name || '');
  const [saving, setSaving] = useState(false);
  const [nameCopied, setNameCopied] = useState(false);
  const [modelCopied, setModelCopied] = useState(false);
  const cpu = loadUsage(agent);
  const memory = memoryUsage(agent);
  const gpu = nestedUsage(agent, 'gpu');
  const disk = nestedUsage(agent, 'disk');
  const model = agent.modelInstances?.[0];
  const modelNames = agent.modelInstances?.map((item) => item.name) ?? [];
  const actions: MenuProps['items'] = [
    {
      key: 'copy-id',
      label: '复制设备标识',
      icon: <CopyOutlined />,
      onClick: onCopyId,
    },
    {
      key: 'rotate',
      label: '轮换凭证',
      icon: <ReloadOutlined />,
      disabled: agent.status === 'created' || agent.status === 'revoked',
      onClick: onRotate,
    },
    { type: 'divider' },
    {
      key: 'revoke',
      label: agent.status === 'created' ? '取消接入' : '撤销设备',
      icon: <StopOutlined />,
      danger: true,
      disabled: agent.status === 'revoked',
      onClick: onRevoke,
    },
  ];

  useEffect(() => {
    if (!nameCopied) return;
    const timer = window.setTimeout(() => setNameCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [nameCopied]);
  useEffect(() => {
    if (!modelCopied) return;
    const timer = window.setTimeout(() => setModelCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [modelCopied]);

  const saveName = async (): Promise<void> => {
    const name = draftName.trim();
    if (!name || name.length > 200 || name === agent.name) {
      if (name === agent.name) setEditing(false);
      return;
    }
    setSaving(true);
    try {
      if (await onRename(name)) setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = (): void => {
    setDraftName(agent.name || '');
    setEditing(false);
  };

  const handleNameKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') void saveName();
    if (event.key === 'Escape') cancelEdit();
  };

  const copyName = async (): Promise<void> => {
    if (await onCopyName()) setNameCopied(true);
  };

  const heartbeatLabel = agent.lastSeenAt
    ? new Date(agent.lastSeenAt).toLocaleString()
    : '暂无记录';
  const snapshotLabel = agent.resourceSnapshotAt
    ? new Date(agent.resourceSnapshotAt).toLocaleString()
    : '暂无记录';

  return (
    <Card className={`device-monitor-card status-${statusOf(agent)}`}>
      <div className={`device-card-head${editing ? ' is-editing' : ''}`}>
        <div className='device-card-identity'>
          <i
            className='device-card-status-dot'
            style={{ background: statusTone[statusOf(agent)] }}
          />
          <div className='device-card-heading'>
            {editing ? (
              <div className='device-name-editor'>
                <Input
                  autoFocus
                  maxLength={200}
                  value={draftName}
                  disabled={saving}
                  onFocus={(event) => event.currentTarget.select()}
                  onChange={(event) => setDraftName(event.target.value)}
                  onKeyDown={handleNameKeyDown}
                  status={!draftName.trim() ? 'error' : undefined}
                  aria-label='设备名称'
                />
                <Tooltip title='保存名称'>
                  <Button
                    type='primary'
                    icon={<CheckOutlined />}
                    loading={saving}
                    disabled={!draftName.trim()}
                    onClick={() => void saveName()}
                    aria-label='保存名称'
                  />
                </Tooltip>
                <Tooltip title='取消编辑'>
                  <Button
                    icon={<CloseOutlined />}
                    disabled={saving}
                    onClick={cancelEdit}
                    aria-label='取消编辑'
                  />
                </Tooltip>
              </div>
            ) : (
              <Tooltip title={nameCopied ? '已复制' : agent.name || agent.id}>
                <span
                  className={`device-name-text${nameCopied ? ' is-copied' : ''}`}
                  role='button'
                  tabIndex={0}
                  onClick={() => void copyName()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      void copyName();
                    }
                  }}
                  aria-label='复制设备名称'
                >
                  {agent.name || agent.id}
                </span>
              </Tooltip>
            )}
          </div>
        </div>
        {!editing && (
          <div className='device-card-actions'>
            <Tooltip title='修改设备名称'>
              <Button
                type='text'
                icon={<EditOutlined />}
                onClick={() => {
                  setDraftName(agent.name || '');
                  setEditing(true);
                }}
                aria-label='修改设备名称'
              />
            </Tooltip>
            <Dropdown
              menu={{ items: actions }}
              trigger={['click']}
              disabled={operating}
            >
              <Tooltip title='设备操作'>
                <Button
                  type='text'
                  loading={operating}
                  icon={<MoreOutlined />}
                  aria-label='设备操作'
                />
              </Tooltip>
            </Dropdown>
          </div>
        )}
      </div>
      <div className='device-model'>
        <span className='device-model-icon'>
          <HddOutlined />
        </span>
        <div className='device-model-copy'>
          <Tooltip
            title={
              modelNames.length
                ? modelCopied
                  ? '已复制'
                  : modelNames.join('、')
                : undefined
            }
          >
            <span
              className={`device-model-name${modelCopied ? ' is-copied' : ''}`}
              role={model?.name ? 'button' : undefined}
              tabIndex={model?.name ? 0 : undefined}
              onClick={() => {
                if (model?.name)
                  void onCopyModel(model.name).then(
                    (copied) => copied && setModelCopied(true),
                  );
              }}
              onKeyDown={(event) => {
                if (
                  model?.name &&
                  (event.key === 'Enter' || event.key === ' ')
                ) {
                  event.preventDefault();
                  void onCopyModel(model.name).then(
                    (copied) => copied && setModelCopied(true),
                  );
                }
              }}
            >
              {model?.name ?? '暂无模型状态'}
            </span>
          </Tooltip>
        </div>
        <div className='device-model-tags'>
          {modelNames.length > 1 && <Tag>+{modelNames.length - 1}</Tag>}
          {model?.state && (
            <Tag color={statusColor(model.state)}>
              {MODEL_STATE_TEXT[model.state] ?? model.state}
            </Tag>
          )}
        </div>
      </div>
      <div className='device-resource-list'>
        <div className='device-network-summary'>
          <span>近 30 天</span>
          <b>{Number(usage?.totalTokens ?? 0).toLocaleString()} Token · {Number(usage?.totalCalls ?? 0).toLocaleString()} 次调用</b>
        </div>
        <ResourceBar label='CPU' value={cpu} />
        <ResourceBar label='内存' value={memory} />
        <ResourceBar label='GPU' value={gpu} />
        <ResourceBar label='磁盘' value={disk} />
      </div>
      <div className='device-card-meta'>
        <div className='device-network-summary'>
          <WifiOutlined />
          <span>网络</span>
          <b>{networkLabel(agent)}</b>
        </div>
        <div className='device-time-list'>
          <span>
            <small>最近心跳</small>
            {heartbeatLabel}
          </span>
          <span>
            <small>资源快照</small>
            {snapshotLabel}
          </span>
        </div>
      </div>
    </Card>
  );
}

function ResourceBar({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div className='device-resource-item'>
      <div className='device-resource-head'>
        <span>{label}</span>
        <b>{value === null ? '暂无数据' : `${value}%`}</b>
      </div>
      <Progress
        percent={value ?? 0}
        showInfo={false}
        strokeColor={
          value === null ? '#64748b' : value > 80 ? '#fb7185' : '#48c8bd'
        }
        trailColor='var(--device-track)'
      />
    </div>
  );
}
