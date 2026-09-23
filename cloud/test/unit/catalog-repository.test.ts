import type { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import { PgCatalogRepository } from '../../src/infrastructure/database/repositories/catalog-repository.js';

type QueryCall = { sql: string; params: unknown[] };

class QueryPool {
  readonly calls: QueryCall[] = [];

  async query(sql: string, params: unknown[] = []): Promise<{ rows: Array<Record<string, unknown>> }> {
    this.calls.push({ sql, params });
    return sql.includes('count(*)::int as total') ? { rows: [{ total: 0 }] } : { rows: [] };
  }
}

const repository = (pool: QueryPool) => new PgCatalogRepository(pool as unknown as Pool);

const maxPlaceholder = (sql: string): number => {
  const indexes = [...sql.matchAll(/\$(\d+)/g)].map((match) => Number(match[1]));
  return indexes.length ? Math.max(...indexes) : 0;
};

const expectParametersMatchSql = (pool: QueryPool) => {
  for (const call of pool.calls) {
    expect(call.params.length).toBeGreaterThanOrEqual(maxPlaceholder(call.sql));
  }
};

describe('PgCatalogRepository 查询参数', () => {
  it('超级管理员无筛选时从 $1 开始分页参数', async () => {
    const pool = new QueryPool();
    await repository(pool).getUsageRecords({ userId: 'unused', role: 'super_admin', page: 1, pageSize: 20 });

    expect(pool.calls[0]?.sql).toContain('where TRUE');
    expect(pool.calls[0]?.params).toEqual([20, 0]);
    expectParametersMatchSql(pool);
  });

  it('超级管理员带时间、筛选、分页和 facets 时参数连续', async () => {
    const pool = new QueryPool();
    await repository(pool).getUsageRecords({
      userId: 'unused',
      role: 'super_admin',
      page: 2,
      pageSize: 50,
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: new Date('2026-02-01T00:00:00.000Z'),
      status: ['success', 'failed'],
      modelIds: ['model-1'],
      deviceIds: ['device-1'],
      groupIds: ['group-1'],
      userIds: ['user-1'],
      includeFacets: true,
    });

    expect(pool.calls[0]?.sql).toContain('ir.started_at >= $1');
    expect(pool.calls[0]?.params).toHaveLength(9);
    expect(pool.calls[0]?.params[0]).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect(pool.calls[0]?.params[7]).toBe(50);
    expect(pool.calls[0]?.params[8]).toBe(50);
    expectParametersMatchSql(pool);
  });

  it('普通用户保留用户权限参数并从 $2 开始业务筛选', async () => {
    const pool = new QueryPool();
    await repository(pool).getUsageAnalytics({
      userId: 'user-1',
      role: 'user',
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: new Date('2026-02-01T00:00:00.000Z'),
      status: ['success'],
      modelIds: ['model-1'],
      deviceIds: ['device-1'],
      groupIds: ['group-1'],
      userIds: [],
      granularity: 'day',
    });

    expect(pool.calls[0]?.sql).toContain('(ir.user_id=$1 OR ir.group_owner_id_snapshot=$1)');
    expect(pool.calls[0]?.sql).toContain('ir.started_at >= $2');
    expect(pool.calls[0]?.params[0]).toBe('user-1');
    expectParametersMatchSql(pool);
  });
});
