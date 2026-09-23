import { Card, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { UsageBreakdownItem } from '../types';

export function BreakdownTable({ title, items, columns }: { title: string; items: UsageBreakdownItem[]; columns?: ColumnsType<UsageBreakdownItem> }): JSX.Element {
  const defaultColumns: ColumnsType<UsageBreakdownItem> = [{ title: '名称', dataIndex: 'name' }, { title: 'Token', dataIndex: 'totalTokens' }];
  return <Card title={title}><Table<UsageBreakdownItem> rowKey={(row) => row.id ?? row.name} size='small' pagination={false} dataSource={items} columns={columns ?? defaultColumns} /></Card>;
}
