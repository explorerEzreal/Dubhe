import { Empty, Table, Tooltip } from 'antd';
import type { TableColumnsType } from 'antd';
import type { UsageRecord } from '../../api/usage-api';
import {
  effortLabel,
  formatCompact,
  formatDateTime,
  formatFullDateTime,
  formatMs,
  statusMeta,
} from './record-utils';

type Props = {
  items: UsageRecord[];
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number, pageSize: number) => void;
  onReset: () => void;
  filtered: boolean;
};

export function UsageRecordTable({ items, loading, total, page, pageSize, onPageChange, onReset, filtered }: Props): JSX.Element {
  const columns: TableColumnsType<UsageRecord> = [
    {
      title: '用户',
      key: 'owner',
      width: 190,
      fixed: 'left',
      render: (_value, row) => (
        <span className="ur-cell-strong ur-ellipsis" title={row.userName}>{row.userName || '—'}</span>
      ),
    },
    {
      title: '分组',
      key: 'groupName',
      width: 150,
      render: (_value, row) => (
        <span className="ur-inline">
          <span className="ur-ellipsis" title={row.groupName}>{row.groupName || '未分组'}</span>
          {row.groupDeleted ? <span className="ur-tag-off">已停用</span> : null}
        </span>
      ),
    },
    {
      title: '模型',
      key: 'modelName',
      width: 170,
      render: (_value, row) => (
        <span className="ur-cell-strong ur-ellipsis" title={row.modelName}>{row.modelName || '—'}</span>
      ),
    },
    {
      title: '设备',
      key: 'deviceName',
      width: 140,
      render: (_value, row) => (
        <span className="ur-ellipsis" title={row.deviceName}>{row.deviceName || '—'}</span>
      ),
    },
    {
      title: '输入 Token',
      key: 'inputTokens',
      width: 120,
      align: 'right',
      render: (_value, row) => <span className="ur-mono">{formatCompact(row.inputTokens)}</span>,
    },
    {
      title: '输出 Token',
      key: 'outputTokens',
      width: 120,
      align: 'right',
      render: (_value, row) => <span className="ur-mono">{formatCompact(row.outputTokens)}</span>,
    },
    {
      title: '总耗时',
      key: 'durationMs',
      width: 110,
      align: 'right',
      render: (_value, row) => <span className="ur-mono">{formatMs(row.durationMs)}</span>,
    },
    {
      title: '推理强度',
      key: 'reasoningEffort',
      width: 100,
      render: (_value, row) => <span className="ur-effort">{effortLabel(row.reasoningEffort)}</span>,
    },
    {
      title: '时间',
      key: 'createdAt',
      width: 140,
      fixed: 'right',
      render: (_value, row) => (
        <Tooltip title={<>{formatFullDateTime(row.createdAt)}<br />{row.requestId || '—'}</>}>
          <span className="ur-cell-strong ur-mono">{formatDateTime(row.createdAt)}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Token',
      key: 'tokens',
      width: 130,
      align: 'right',
      fixed: 'right',
      render: (_value, row) => <span className="ur-cell-strong ur-mono">{formatCompact(row.totalTokens)}</span>,
    },
    {
      title: '状态',
      key: 'status',
      width: 108,
      fixed: 'right',
      render: (_value, row) => {
        const meta = statusMeta(row.status);
        return <span className="ur-status" data-tone={meta.tone}><i />{meta.label}</span>;
      },
    },
  ];

  return (
    <Table<UsageRecord>
      rowKey="id"
      size="middle"
      loading={loading}
      dataSource={items}
      columns={columns}
      scroll={{ x: 1478 }}
      locale={{
        emptyText: (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={<span className="ur-empty-hint">{filtered ? '当前筛选条件下没有使用记录' : '该时间范围内还没有使用记录'}</span>}
          >
            {filtered ? <button className="link-button" onClick={onReset}>清空筛选</button> : null}
          </Empty>
        ),
      }}
      pagination={{
        current: page,
        pageSize,
        total,
        showSizeChanger: true,
        pageSizeOptions: [20, 50, 100],
        showTotal: (count) => `共 ${count.toLocaleString('zh-CN')} 条记录`,
        onChange: onPageChange,
      }}
    />
  );
}
