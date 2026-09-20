import type { Pool } from 'pg';
import type { CatalogRepository } from '../../../application/ports.js';

const USAGE_QUERY = `
  select
    count(*)::int as "totalCalls",
    coalesce(sum(total_tokens),0)::float as "totalTokens",
    coalesce(sum(coalesce(input_tokens, 0)),0)::float as "inputTokens",
    coalesce(sum(coalesce(output_tokens, 0)),0)::float as "outputTokens",
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
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        errorRate: 0,
        avgLatencyMs: 0,
      };
    } catch (error) {
      throw error;
    }
  }

  async getMonitoring(userId: string, from: Date, to: Date, monitoringScope: 'caller' | 'deployer', granularity: 'hour' | 'day' = 'day'): Promise<Record<string, unknown>> {
    const scope = monitoringScope === 'deployer'
      ? `exists (select 1 from groups owner_group where owner_group.id=ir.group_id and owner_group.user_id=$1)`
      : `ir.user_id=$1`;
    const params = [userId, from, to];
    try {
      const todayFrom = new Date(); todayFrom.setUTCHours(0, 0, 0, 0);
      const [overview, todayOverview, trend, groups, users, keys, models, agents, requests] = await Promise.all([
        this.pool.query(`select count(*)::int as "totalCalls",
          coalesce(sum(ir.total_tokens),0)::float as "totalTokens",
          coalesce(sum(coalesce(ir.input_tokens,0)),0)::float as "inputTokens",
          coalesce(sum(coalesce(ir.output_tokens,0)),0)::float as "outputTokens",
          coalesce(avg(case when ir.status in ('failed','timeout','cancelled','agent_disconnected') then 1 else 0 end),0)::float as "errorRate",
          coalesce(avg(ir.latency_ms),0)::int as "avgLatencyMs",
          coalesce(percentile_cont(0.5) within group (order by ir.latency_ms),0)::int as "p50LatencyMs",
          coalesce(percentile_cont(0.95) within group (order by ir.latency_ms),0)::int as "p95LatencyMs",
          count(*) filter (where ir.input_tokens is null or ir.output_tokens is null)::int as "missingTokenCalls",
          count(*) filter (where ir.group_id is null)::int as "ungroupedCalls",
          count(distinct ir.user_id)::int as "activeUsers",
          count(distinct ir.api_key_id)::int as "activeApiKeys",
          count(distinct ir.agent_id)::int as "activeDevices",
          (select count(*)::int from agents where user_id=$1) as "totalDevices",
          max(ir.started_at) as "lastRequestAt"
          from inference_requests ir where ${scope} and ir.started_at >= $2 and ir.started_at < $3`, params),
        this.pool.query(`select count(*)::int as "totalCalls",
          coalesce(sum(ir.total_tokens),0)::float as "totalTokens",
          coalesce(avg(case when ir.status in ('failed','timeout','cancelled','agent_disconnected') then 1 else 0 end),0)::float as "errorRate"
          from inference_requests ir where ${scope} and ir.started_at >= $2 and ir.started_at < $3`, [userId, todayFrom, new Date()]),
        this.pool.query(`select date_trunc('${granularity}', ir.started_at) as date, count(*)::int as "totalCalls",
          coalesce(sum(ir.total_tokens),0)::float as "totalTokens",
          coalesce(avg(case when ir.status in ('failed','timeout','cancelled','agent_disconnected') then 1 else 0 end),0)::float as "errorRate"
          from inference_requests ir where ${scope} and ir.started_at >= $2 and ir.started_at < $3
          group by 1 order by 1`, params),
        this.pool.query(`select ir.group_id as id, coalesce(g.name,'未分组') as name, count(*)::int as "totalCalls",
          coalesce(sum(ir.total_tokens),0)::float as "totalTokens"
          from inference_requests ir left join groups g on g.id=ir.group_id where ${scope} and ir.started_at >= $2 and ir.started_at < $3
          group by ir.group_id,g.name order by "totalTokens" desc`, params),
        this.pool.query(`select ir.user_id as id, u.email, ir.group_id as "groupId", coalesce(g.name,'未分组') as "groupName",
          count(*)::int as "totalCalls", coalesce(sum(ir.total_tokens),0)::float as "totalTokens",
          coalesce(avg(ir.latency_ms),0)::int as "avgLatencyMs", max(ir.started_at) as "lastUsedAt"
          from inference_requests ir join users u on u.id=ir.user_id left join groups g on g.id=ir.group_id
          where ${scope} and ir.started_at >= $2 and ir.started_at < $3 group by ir.user_id,u.email,ir.group_id,g.name order by "totalTokens" desc`, params),
        this.pool.query(`select ir.api_key_id as id, coalesce(ak.prefix,'已删除 Key') as prefix, ir.group_id as "groupId",
          count(*)::int as "totalCalls", coalesce(sum(ir.total_tokens),0)::float as "totalTokens"
          from inference_requests ir left join api_keys ak on ak.id=ir.api_key_id where ${scope} and ir.started_at >= $2 and ir.started_at < $3
          group by ir.api_key_id,ak.prefix,ir.group_id order by "totalTokens" desc`, params),
        this.pool.query(`select ir.model_id as id, coalesce(ir.model_name_snapshot,m.name,'未知模型') as name, count(*)::int as "totalCalls",
          coalesce(sum(ir.total_tokens),0)::float as "totalTokens"
          from inference_requests ir left join models m on m.id=ir.model_id where ${scope} and ir.started_at >= $2 and ir.started_at < $3
          group by ir.model_id,ir.model_name_snapshot,m.name order by "totalTokens" desc`, params),
        this.pool.query(`select ir.agent_id as id, coalesce(ir.device_name_snapshot,a.name,a.device_id,'未知设备') as name, count(*)::int as "totalCalls",
          coalesce(sum(ir.total_tokens),0)::float as "totalTokens"
          from inference_requests ir left join agents a on a.id=ir.agent_id where ${scope} and ir.started_at >= $2 and ir.started_at < $3
          group by ir.agent_id,ir.device_name_snapshot,a.name,a.device_id order by "totalTokens" desc`, params),
        this.pool.query(`select ir.request_id as "requestId", ir.started_at as "startedAt", u.email, coalesce(ir.group_name_snapshot,g.name,'未分组') as "groupName",
          coalesce(ak.prefix,'已删除 Key') as "apiKeyPrefix", coalesce(ir.model_name_snapshot,m.name,'未知模型') as "modelName", coalesce(ir.device_name_snapshot,a.name,a.device_id,'未知设备') as "agentName",
          ir.status, ir.error_code as "errorCode", ir.input_tokens as "inputTokens", ir.output_tokens as "outputTokens",
          ir.total_tokens as "totalTokens", ir.latency_ms as "latencyMs", ir.endpoint, ir.request_bytes as "requestBytes", ir.response_bytes as "responseBytes", ir.upstream_status_code as "upstreamStatusCode", ir.usage_available as "usageAvailable"
          from inference_requests ir join users u on u.id=ir.user_id left join groups g on g.id=ir.group_id left join api_keys ak on ak.id=ir.api_key_id
          left join models m on m.id=ir.model_id left join agents a on a.id=ir.agent_id where ${scope} and ir.started_at >= $2 and ir.started_at < $3
          order by ir.started_at desc limit 201`, params),
      ]);
      const truncated = requests.rows.length > 200;
      return { overview: overview.rows[0], todayOverview: todayOverview.rows[0], trend: trend.rows, groups: groups.rows, users: users.rows, apiKeys: keys.rows, models: models.rows, agents: agents.rows, requests: requests.rows.slice(0, 200), dataQuality: { missingTokenCalls: Number(overview.rows[0]?.missingTokenCalls ?? 0), ungroupedCalls: Number(overview.rows[0]?.ungroupedCalls ?? 0), truncated }, generatedAt: new Date().toISOString(), granularity };
    } catch (error) {
      throw error;
    }
  }
}
