import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { Button, Card, Input, Progress, Tag } from 'antd';
import {
  SearchOutlined,
  AppstoreOutlined,
  HddOutlined,
  ClusterOutlined,
  WifiOutlined,
} from '@ant-design/icons';
import type { AgentSummary } from '../../api/agent-api';
import type { GroupSummary } from '../../api/group-api';
import { AGENT_STATUS_TEXT, statusColor } from '../../constants';

export type DeviceStatusFilter = 'all' | 'online' | 'busy' | 'offline';

const statusTone: Record<DeviceStatusFilter, string> = {
  all: '#94a3b8',
  online: '#35d399',
  busy: '#fbbf24',
  offline: '#64748b',
};

function statusOf(agent: AgentSummary): DeviceStatusFilter {
  if (agent.status === 'online') return 'online';
  if (['connecting', 'degraded'].includes(agent.status)) return 'busy';
  return 'offline';
}

function metricNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function memoryUsage(agent: AgentSummary): number | null {
  const memory = agent.hardwareInfo?.memory as
    | { totalBytes?: unknown; freeBytes?: unknown }
    | undefined;
  const total = metricNumber(memory?.totalBytes);
  const free = metricNumber(memory?.freeBytes);
  if (!total || free === null || free > total) return null;
  return Math.round(((total - free) / total) * 100);
}

function loadUsage(agent: AgentSummary): number | null {
  const cpu = agent.hardwareInfo?.cpu as
    | { loadAverage?: unknown; cores?: unknown }
    | undefined;
  const load = Array.isArray(cpu?.loadAverage)
    ? metricNumber(cpu.loadAverage[0])
    : null;
  const cores = metricNumber(cpu?.cores);
  if (load === null || !cores) return null;
  return Math.min(100, Math.round((load / cores) * 100));
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
  const filters: Array<[DeviceStatusFilter, string]> = [
    ['all', '全部状态'],
    ['online', '在线'],
    ['busy', '繁忙'],
    ['offline', '离线'],
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

export function OverviewCards({
  agents,
  dark,
}: {
  agents: AgentSummary[];
  dark: boolean;
}) {
  const counts = agents.reduce(
    (result, agent) => {
      result[statusOf(agent)] += 1;
      return result;
    },
    { all: agents.length, online: 0, busy: 0, offline: 0 } as Record<
      DeviceStatusFilter,
      number
    >,
  );
  const averageMemory = agents
    .map(memoryUsage)
    .filter((value): value is number => value !== null);
  const averageCpu = agents
    .map(loadUsage)
    .filter((value): value is number => value !== null);
  const statusOption: EChartsOption = {
    tooltip: { trigger: 'item' },
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
            itemStyle: { color: '#35d399' },
          },
          { value: counts.busy, name: '繁忙', itemStyle: { color: '#fbbf24' } },
          {
            value: counts.offline,
            name: '离线',
            itemStyle: { color: '#64748b' },
          },
        ],
      },
    ],
  };
  const resourceOption: EChartsOption = {
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'pie',
        radius: ['58%', '78%'],
        center: ['27%', '50%'],
        label: {
          show: true,
          position: 'center',
          formatter: `${averageCpu.length ? Math.round(averageCpu.reduce((a, b) => a + b, 0) / averageCpu.length) : 0}%`,
          color: dark ? '#e2e8f0' : '#334155',
          fontSize: 16,
        },
        data: [
          {
            value: averageCpu.length
              ? Math.round(
                  averageCpu.reduce((a, b) => a + b, 0) / averageCpu.length,
                )
              : 0,
            itemStyle: { color: '#48c8bd' },
          },
          { value: 100, itemStyle: { color: dark ? '#243142' : '#e2e8f0' } },
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
          color: dark ? '#e2e8f0' : '#334155',
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
            itemStyle: { color: '#48c8bd' },
          },
          { value: 100, itemStyle: { color: dark ? '#243142' : '#e2e8f0' } },
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
        lineStyle: { color: '#48c8bd', width: 2 },
        areaStyle: { color: 'rgba(72,200,189,.16)' },
      },
    ],
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: 'middle',
        style: {
          text: '暂无网络历史数据',
          fill: dark ? '#94a3b8' : '#64748b',
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
            <i className='status-dot' style={{ background: statusTone.busy }} />
            繁忙 {counts.busy}
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
          {(['online', 'busy', 'offline'] as DeviceStatusFilter[]).map(
            (key) => (
              <span key={key}>
                <i
                  className='status-dot'
                  style={{ background: statusTone[key] }}
                />
                {key === 'online' ? '在线' : key === 'busy' ? '繁忙' : '离线'}{' '}
                {counts[key]}
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
  onRotate,
  onRevoke,
}: {
  agent: AgentSummary;
  onRotate: () => void;
  onRevoke: () => void;
}) {
  const cpu = loadUsage(agent);
  const memory = memoryUsage(agent);
  const model = agent.modelInstances?.[0];
  return (
    <Card className={`device-monitor-card status-${statusOf(agent)}`}>
      <div className='device-card-head'>
        <div>
          <span className='device-name'>
            <i
              className='status-dot'
              style={{ background: statusTone[statusOf(agent)] }}
            />
            {agent.name || agent.id}
          </span>
          <div className='device-id'>{agent.id}</div>
        </div>
        <Tag color={statusColor(agent.status)}>
          {AGENT_STATUS_TEXT[agent.status] ?? agent.status}
        </Tag>
      </div>
      <div className='device-model'>
        <HddOutlined /> {model?.name ?? '暂无模型状态'}
      </div>
      <div className='device-resource-list'>
        <ResourceBar label='CPU' value={cpu} />
        <ResourceBar label='内存' value={memory} />
        <ResourceBar label='GPU' value={null} />
        <ResourceBar label='磁盘' value={null} />
      </div>
      <div className='device-card-foot'>
        <span>
          {agent.lastSeenAt
            ? `最近心跳 ${new Date(agent.lastSeenAt).toLocaleString()}`
            : '暂无心跳记录'}
        </span>
        <span className='device-card-actions'>
          <Button type='link' onClick={onRotate}>
            轮换凭证
          </Button>
          <Button type='link' danger onClick={onRevoke}>
            撤销
          </Button>
        </span>
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
    <div className='resource-row'>
      <span>{label}</span>
      <Progress
        percent={value ?? 0}
        showInfo={false}
        strokeColor={
          value === null ? '#64748b' : value > 80 ? '#fb7185' : '#48c8bd'
        }
        trailColor='var(--device-track)'
      />
      <b>{value === null ? '暂无数据' : `${value}%`}</b>
    </div>
  );
}
