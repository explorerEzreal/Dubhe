import type { Pool } from 'pg';
import type { CatalogRepository, UsageAnalyticsQuery, UsageRecordPage, UsageRecordsQuery } from '../../../application/ports.js';

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

  private accessClause(input: UsageRecordsQuery | UsageAnalyticsQuery, startIndex: number): { clause: string; params: unknown[]; next: number } {
    const params: unknown[] = [input.userId];
    const access = input.role === 'super_admin' ? 'TRUE' : '(ir.user_id=$1 OR ir.group_owner_id_snapshot=$1)';
    let next = startIndex;
    const conditions = [access];
    const add = (sql: string, value: unknown) => { params.push(value); conditions.push(sql.replace('?', `$${next}`)); next += 1; };
    if (input.from) add('ir.started_at >= ?', input.from);
    if (input.to) add('ir.started_at < ?', input.to);
    if (input.status?.length) add(`ir.status = any(?::text[])`, input.status);
    if (input.modelIds?.length) add(`ir.model_id = any(?::uuid[])`, input.modelIds);
    if (input.deviceIds?.length) add(`ir.agent_id = any(?::uuid[])`, input.deviceIds);
    if (input.groupIds?.length) add(`ir.group_id = any(?::uuid[])`, input.groupIds);
    if (input.userIds?.length) add(`ir.user_id = any(?::uuid[])`, input.userIds);
    return { clause: conditions.join(' and '), params, next };
  }

  async getUsageRecords(input: UsageRecordsQuery): Promise<UsageRecordPage> {
    const base = this.accessClause(input, 2);
    const offset = (input.page - 1) * input.pageSize;
    const listParams = [...base.params, input.pageSize, offset];
    const [items, total] = await Promise.all([
      this.pool.query(`select ir.id, ir.request_id as "requestId", ir.started_at as "createdAt", ir.user_id as "userId",
        u.email as "userName", ir.group_id as "groupId", coalesce(ir.group_name_snapshot,g.name,'未分组') as "groupName",
        (g.deleted_at is not null) as "groupDeleted", ir.agent_id as "deviceId", coalesce(ir.device_name_snapshot,a.name,a.device_id,'未知设备') as "deviceName",
        ir.model_id as "modelId", coalesce(ir.model_name_snapshot,m.name,'未知模型') as "modelName", ir.status,
        ir.input_tokens as "inputTokens", ir.output_tokens as "outputTokens", ir.total_tokens as "totalTokens",
        ir.first_token_latency_ms as "firstTokenLatencyMs", ir.latency_ms as "durationMs", ir.reasoning_effort as "reasoningEffort"
        from inference_requests ir join users u on u.id=ir.user_id left join groups g on g.id=ir.group_id left join agents a on a.id=ir.agent_id left join models m on m.id=ir.model_id
        where ${base.clause} order by ir.started_at desc, ir.id desc limit $${base.next} offset $${base.next + 1}`, [...listParams]),
      this.pool.query(`select count(*)::int as total from inference_requests ir where ${base.clause}`, base.params),
    ]);
    const result: UsageRecordPage = { items: items.rows as Array<Record<string, unknown>>, page: input.page, pageSize: input.pageSize, total: Number(total.rows[0]?.total ?? 0) };
    if (input.includeFacets) {
      const facetParams = base.params;
      const [statuses, models, devices, groups, users] = await Promise.all([
        this.pool.query(`select distinct ir.status from inference_requests ir where ${base.clause} order by ir.status`, facetParams),
        this.pool.query(`select distinct ir.model_id as id, coalesce(ir.model_name_snapshot,m.name,'未知模型') as name from inference_requests ir left join models m on m.id=ir.model_id where ${base.clause} and ir.model_id is not null order by name`, facetParams),
        this.pool.query(`select distinct ir.agent_id as id, coalesce(ir.device_name_snapshot,a.name,a.device_id,'未知设备') as name from inference_requests ir left join agents a on a.id=ir.agent_id where ${base.clause} and ir.agent_id is not null order by name`, facetParams),
        this.pool.query(`select distinct ir.group_id as id, coalesce(ir.group_name_snapshot,g.name,'未分组') as name, (g.deleted_at is not null) as deleted from inference_requests ir left join groups g on g.id=ir.group_id where ${base.clause} and ir.group_id is not null order by name`, facetParams),
        input.role === 'super_admin' ? this.pool.query(`select distinct ir.user_id as id, u.email as name from inference_requests ir join users u on u.id=ir.user_id where ${base.clause} order by name`, facetParams) : Promise.resolve({ rows: [] }),
      ]);
      result.facets = { statuses: statuses.rows.map((row) => String(row.status)), models: models.rows as Array<{ id: string; name: string }>, devices: devices.rows as Array<{ id: string; name: string }>, groups: groups.rows as Array<{ id: string; name: string; deleted: boolean }>, ...(input.role === 'super_admin' ? { users: users.rows as Array<{ id: string; name: string }> } : {}) };
    }
    return result;
  }

  async getUsageAnalytics(input: UsageAnalyticsQuery): Promise<Record<string, unknown>> {
    const base = this.accessClause(input, 2);
    const bucket = input.granularity === 'hour' ? 'hour' : 'day';
    const [overview, trend, users, groups, models, devices] = await Promise.all([
      this.pool.query(`select count(*)::int as "totalCalls", sum(ir.total_tokens)::float as "totalTokens", sum(ir.input_tokens)::float as "inputTokens", sum(ir.output_tokens)::float as "outputTokens", coalesce(avg((ir.status in ('failed','timeout','cancelled','agent_disconnected'))::int),0)::float as "errorRate", avg(ir.latency_ms)::float as "avgLatencyMs", percentile_cont(0.5) within group (order by ir.latency_ms)::float as "p50LatencyMs", percentile_cont(0.95) within group (order by ir.latency_ms)::float as "p95LatencyMs", count(distinct ir.user_id)::int as "activeUsers", count(distinct ir.api_key_id)::int as "activeApiKeys", count(distinct ir.agent_id)::int as "activeDevices", max(ir.started_at) as "lastRequestAt", count(*) filter (where ir.input_tokens is null or ir.output_tokens is null)::int as "missingTokenCalls", count(*) filter (where ir.group_id is null)::int as "ungroupedCalls", count(*) filter (where ir.first_token_latency_ms is null and ir.stream)::int as "firstTokenLatencyMissing" from inference_requests ir where ${base.clause}`, base.params),
      this.pool.query(`select date_trunc('${bucket}',ir.started_at) as date,count(*)::int as "totalCalls",sum(ir.total_tokens)::float as "totalTokens",coalesce(avg((ir.status in ('failed','timeout','cancelled','agent_disconnected'))::int),0)::float as "errorRate" from inference_requests ir where ${base.clause} group by 1 order by 1`, base.params),
      this.pool.query(`select ir.user_id as id,u.email as name,count(*)::int as "totalCalls",sum(ir.total_tokens)::float as "totalTokens",avg(ir.latency_ms)::float as "avgLatencyMs" from inference_requests ir join users u on u.id=ir.user_id where ${base.clause} group by ir.user_id,u.email order by "totalTokens" desc`, base.params),
      this.pool.query(`select ir.group_id as id,coalesce(ir.group_name_snapshot,g.name,'未分组') as name,count(*)::int as "totalCalls",sum(ir.total_tokens)::float as "totalTokens",avg(ir.latency_ms)::float as "avgLatencyMs" from inference_requests ir left join groups g on g.id=ir.group_id where ${base.clause} group by ir.group_id,ir.group_name_snapshot,g.name order by "totalTokens" desc`, base.params),
      this.pool.query(`select ir.model_id as id,coalesce(ir.model_name_snapshot,m.name,'未知模型') as name,count(*)::int as "totalCalls",sum(ir.total_tokens)::float as "totalTokens",avg(ir.latency_ms)::float as "avgLatencyMs" from inference_requests ir left join models m on m.id=ir.model_id where ${base.clause} group by ir.model_id,ir.model_name_snapshot,m.name order by "totalTokens" desc`, base.params),
      this.pool.query(`select ir.agent_id as id,coalesce(ir.device_name_snapshot,a.name,a.device_id,'未知设备') as name,count(*)::int as "totalCalls",sum(ir.total_tokens)::float as "totalTokens",avg(ir.latency_ms)::float as "avgLatencyMs" from inference_requests ir left join agents a on a.id=ir.agent_id where ${base.clause} group by ir.agent_id,ir.device_name_snapshot,a.name,a.device_id order by "totalTokens" desc`, base.params),
    ]);
    const row = overview.rows[0] ?? {};
    return { overview: row, trend: trend.rows, breakdowns: { users: users.rows, groups: groups.rows, models: models.rows, devices: devices.rows }, dataQuality: { missingTokenCalls: Number(row.missingTokenCalls ?? 0), ungroupedCalls: Number(row.ungroupedCalls ?? 0), firstTokenLatencyMissing: Number(row.firstTokenLatencyMissing ?? 0) }, generatedAt: new Date().toISOString() };
  }
}
