import { FileTextOutlined } from '@ant-design/icons';
import { Card, Empty, Pagination, Tag, Tooltip } from 'antd';
import type { ReactNode } from 'react';
import type { UsageRecord } from '../../api/usage-api';
import { ContentLoadingState, ErrorState } from '../StateView';
import './UsageRecordTable.less';

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
  onViewAll?: () => void;
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
  onViewAll,
  title,
  description,
}: Props): JSX.Element {
  const hasData = items.length > 0;
  const isRecords = mode === 'records';
  return (
    <Card
      className='design-card design-recent usage-record-table-card'
      title={
        <span className='usage-record-card-title'>
          <FileTextOutlined />
          {title ?? (isRecords ? '请求明细' : '最近调用')}{' '}
          {!isRecords ? <small>仅展示最新 {items.length} 条</small> : null}
        </span>
      }
      extra={
        onViewAll ? (
          <button className='usage-record-view-all' onClick={onViewAll}>
            查看全部
          </button>
        ) : null
      }
    >
      {description ? (
        <div className='usage-record-description'>{description}</div>
      ) : null}
      {error && hasData ? <ErrorState onRetry={onRetry} /> : null}
      <div className='usage-record-table-wrap'>
        {error && !hasData ? (
          <ErrorState onRetry={onRetry} />
        ) : loading && !hasData ? (
          <ContentLoadingState />
        ) : hasData ? (
          <table className='usage-record-table'>
            <thead>
              <tr>
                {(isRecords
                  ? [
                      '用户',
                      '分组',
                      '模型',
                      '设备',
                      '输入 Token',
                      '输出 Token',
                      '总耗时',
                      '时间',
                      'Token',
                      '状态',
                    ]
                  : [
                      '时间',
                      '用户',
                      '分组',
                      '模型',
                      '设备',
                      '状态',
                      '延迟',
                      'Token',
                    ]
                ).map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const status = statusMeta(item.status);
                return (
                  <tr key={item.id || item.requestId}>
                    {isRecords ? (
                      <>
                        <td className='usage-record-strong'>
                          {item.userName || '—'}
                        </td>
                        <td>
                          {item.groupName || '未分组'}
                          {item.groupDeleted ? (
                            <span className='usage-record-off'>已停用</span>
                          ) : null}
                        </td>
                        <td className='usage-record-strong'>
                          {item.modelName || '—'}
                        </td>
                        <td>{item.deviceName || '—'}</td>
                        <td className='mono'>{compact(item.inputTokens)}</td>
                        <td className='mono'>{compact(item.outputTokens)}</td>
                        <td className='mono'>
                          {item.durationMs == null
                            ? '—'
                            : `${Math.round(item.durationMs)} ms`}
                        </td>
                        <td className='mono'>
                          <Tooltip
                            title={
                              <>
                                {fullTime(item.createdAt)}
                                <br />
                                {item.requestId || '—'}
                              </>
                            }
                          >
                            <span>{fullTime(item.createdAt)}</span>
                          </Tooltip>
                        </td>
                        <td className='usage-record-strong mono'>
                          {compact(item.totalTokens)}
                        </td>
                        <td>
                          <Tag color={status.color}>{status.label}</Tag>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className='mono'>{time(item.createdAt)}</td>
                        <td>{item.userName || '—'}</td>
                        <td>{item.groupName || '未分组'}</td>
                        <td>{item.modelName || '未知模型'}</td>
                        <td>{item.deviceName || '未知设备'}</td>
                        <td>
                          <Tag color={status.color}>{status.label}</Tag>
                        </td>
                        <td className='mono'>
                          {item.durationMs == null
                            ? '—'
                            : `${Math.round(item.durationMs)} ms`}
                        </td>
                        <td className='mono'>{compact(item.totalTokens)}</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
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
      </div>
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
    </Card>
  );
}
