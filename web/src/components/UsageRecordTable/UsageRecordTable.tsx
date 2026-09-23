import {
  Empty,
  Pagination,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { ReactNode } from 'react';
import type { UsageRecord } from '../../api/usage-api';
import { ContentLoadingState, ErrorState } from '../StateView';
import './UsageRecordTable.less';

const { Text, Title } = Typography;

type Mode = 'dashboard' | 'records';
type Props = {
  mode?: Mode;
  items: UsageRecord[];
  loading: boolean;
  error?: boolean;
  total?: number;
  page?: number;
  pageSize?: number;
  filtered?: boolean;
  truncated?: boolean;
  onRetry: () => void;
  onReset?: () => void;
  onPageChange?: (page: number, pageSize: number) => void;
  title?: ReactNode;
  description?: ReactNode;
};

const statusMeta = (status: string): { label: string; color: string } => {
  const key = String(status).toLowerCase();
  if (['completed', 'success', 'succeeded', 'ok'].includes(key))
    return { label: '成功', color: 'success' };
  if (['failed', 'error', 'failure'].includes(key))
    return { label: '失败', color: 'error' };
  return {
    label:
      key === 'cancelled' || key === 'canceled'
        ? '已取消'
        : key === 'timeout'
          ? '超时'
          : '进行中',
    color: 'warning',
  };
};
const compact = (value: number | null): string =>
  value == null ? '—' : Number(value).toLocaleString('zh-CN');
const time = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString();
};
const fullTime = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

export function UsageRecordTable({
  mode = 'dashboard',
  items,
  loading,
  error = false,
  total = 0,
  page = 1,
  pageSize = 20,
  filtered = false,
  truncated = false,
  onRetry,
  onReset,
  onPageChange,
  title,
  description,
}: Props): JSX.Element {
  const hasData = items.length > 0;
  const isRecords = mode === 'records';
  const columns: ColumnsType<UsageRecord> = isRecords
    ? [
        {
          title: '用户',
          key: 'userName',
          dataIndex: 'userName',
          width: 140,
          ellipsis: true,
          render: (value: string | null) => (
            <span className='usage-record-strong'>{value || '—'}</span>
          ),
        },
        {
          title: '分组',
          key: 'groupName',
          dataIndex: 'groupName',
          width: 150,
          ellipsis: true,
          render: (value: string | null, item) => (
            <span>
              {value || '未分组'}
              {item.groupDeleted ? (
                <span className='usage-record-off'>已停用</span>
              ) : null}
            </span>
          ),
        },
        {
          title: '模型',
          key: 'modelName',
          dataIndex: 'modelName',
          width: 180,
          ellipsis: true,
          render: (value: string | null) => (
            <span className='usage-record-strong'>{value || '—'}</span>
          ),
        },
        {
          title: '设备',
          key: 'deviceName',
          dataIndex: 'deviceName',
          width: 150,
          ellipsis: true,
          render: (value: string | null) => value || '—',
        },
        {
          title: '输入 Token',
          key: 'inputTokens',
          dataIndex: 'inputTokens',
          width: 110,
          render: (value: number | null) => (
            <span className='mono'>{compact(value)}</span>
          ),
        },
        {
          title: '输出 Token',
          key: 'outputTokens',
          dataIndex: 'outputTokens',
          width: 110,
          render: (value: number | null) => (
            <span className='mono'>{compact(value)}</span>
          ),
        },
        {
          title: '总耗时',
          key: 'durationMs',
          dataIndex: 'durationMs',
          width: 100,
          render: (value: number | null) => (
            <span className='mono'>
              {value == null ? '—' : `${Math.round(value)} ms`}
            </span>
          ),
        },
        {
          title: '时间',
          key: 'createdAt',
          dataIndex: 'createdAt',
          width: 180,
          render: (value: string, item) => (
            <Tooltip
              title={
                <>
                  {fullTime(value)}
                  <br />
                  {item.requestId || '—'}
                </>
              }
            >
              <span className='mono'>{fullTime(value)}</span>
            </Tooltip>
          ),
        },
        {
          title: 'Token',
          key: 'totalTokens',
          dataIndex: 'totalTokens',
          width: 100,
          render: (value: number | null) => (
            <span className='usage-record-strong mono'>{compact(value)}</span>
          ),
        },
        {
          title: '状态',
          key: 'status',
          dataIndex: 'status',
          width: 90,
          render: (value: string) => {
            const status = statusMeta(value);
            return <Tag color={status.color}>{status.label}</Tag>;
          },
        },
      ]
    : [
        {
          title: '时间',
          key: 'createdAt',
          dataIndex: 'createdAt',
          width: 100,
          render: (value: string) => (
            <span className='mono'>{time(value)}</span>
          ),
        },
        {
          title: '用户',
          key: 'userName',
          dataIndex: 'userName',
          width: 140,
          ellipsis: true,
          render: (value: string | null) => value || '—',
        },
        {
          title: '分组',
          key: 'groupName',
          dataIndex: 'groupName',
          width: 150,
          ellipsis: true,
          render: (value: string | null) => value || '未分组',
        },
        {
          title: '模型',
          key: 'modelName',
          dataIndex: 'modelName',
          width: 180,
          ellipsis: true,
          render: (value: string | null) => value || '未知模型',
        },
        {
          title: '设备',
          key: 'deviceName',
          dataIndex: 'deviceName',
          width: 150,
          ellipsis: true,
          render: (value: string | null) => value || '未知设备',
        },
        {
          title: '状态',
          key: 'status',
          dataIndex: 'status',
          width: 90,
          render: (value: string) => {
            const status = statusMeta(value);
            return <Tag color={status.color}>{status.label}</Tag>;
          },
        },
        {
          title: '延迟',
          key: 'durationMs',
          dataIndex: 'durationMs',
          width: 100,
          render: (value: number | null) => (
            <span className='mono'>
              {value == null ? '—' : `${Math.round(value)} ms`}
            </span>
          ),
        },
        {
          title: 'Token',
          key: 'totalTokens',
          dataIndex: 'totalTokens',
          width: 100,
          render: (value: number | null) => (
            <span className='mono'>{compact(value)}</span>
          ),
        },
      ];
  return (
    <section className='usage-record-table-view'>
      {error && hasData ? <ErrorState onRetry={onRetry} /> : null}
      {error && !hasData ? (
        <ErrorState onRetry={onRetry} />
      ) : loading && !hasData ? (
        <ContentLoadingState />
      ) : hasData ? (
        <Table<UsageRecord>
          rowKey={(item) => item.id || item.requestId}
          // size='small'
          dataSource={items}
          columns={columns}
          pagination={false}
          scroll={{ x: isRecords ? 1360 : 1060 }}
          title={() => (
            <Space align='baseline'>
              <Text className='usage-record-table-title-text'>
                {title ?? (isRecords ? '使用记录' : '最近使用')}
              </Text>
              <Text className='usage-record-table-description'>
                {description}
              </Text>
            </Space>
          )}
        />
      ) : (
        <div className='usage-record-empty'>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              filtered
                ? '当前筛选条件下没有使用记录'
                : '该时间范围内还没有使用记录'
            }
          >
            {filtered && onReset ? (
              <button className='link-button' onClick={onReset}>
                清空筛选
              </button>
            ) : null}
          </Empty>
        </div>
      )}
      {isRecords && onPageChange ? (
        <div className='usage-record-pagination'>
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            showSizeChanger
            pageSizeOptions={[20, 50, 100]}
            showTotal={(count) => `共 ${count.toLocaleString('zh-CN')} 条记录`}
            onChange={onPageChange}
          />
        </div>
      ) : (
        <div className='usage-record-foot'>
          <span>
            {loading
              ? '刷新中...'
              : truncated
                ? '最近调用已截断'
                : `共 ${items.length} 条记录`}
          </span>
          <span className='mono'>实时数据</span>
        </div>
      )}
    </section>
  );
}
