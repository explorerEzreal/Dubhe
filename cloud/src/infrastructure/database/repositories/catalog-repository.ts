import type { Pool } from 'pg';
import type { CatalogRepository } from '../../../application/ports.js';

const USAGE_QUERY = `
  select
    count(*)::int as "totalCalls",
    coalesce(avg(case when status in ('failed','timeout') then 1 else 0 end),0)::float as "errorRate",
    coalesce(avg(latency_ms),0)::int as "avgLatencyMs"
  from inference_requests
  where user_id=$1
`;

export class PgCatalogRepository implements CatalogRepository {
  constructor(private readonly pool: Pool) {}

  async listModels(): Promise<Array<Record<string, unknown>>> {
    try {
      const result = await this.pool.query(
        `select
           m.id,
           m.name,
           m.engine,
           m.description,
           count(mi.id)::int as "instanceCount",
           count(mi.id) filter (where mi.state='ready' and a.status='online')::int as "readyInstances",
           case
             when count(mi.id) filter (where mi.state='ready' and a.status='online') > 0 then 'ready'
             when count(mi.id) > 0 then 'offline'
             else 'unknown'
           end as status
         from models m
         left join model_instances mi on mi.model_id=m.id
         left join agents a on a.id=mi.agent_id
         group by m.id, m.name, m.engine, m.description
         order by m.name`,
      );
      return result.rows as Array<Record<string, unknown>>;
    } catch (error) {
      throw error;
    }
  }

  async getUsage(userId: string): Promise<Record<string, unknown>> {
    try {
      const result = await this.pool.query(USAGE_QUERY, [userId]);
      return (result.rows[0] as Record<string, unknown> | undefined) ?? {
        totalCalls: 0,
        errorRate: 0,
        avgLatencyMs: 0,
      };
    } catch (error) {
      throw error;
    }
  }
}
