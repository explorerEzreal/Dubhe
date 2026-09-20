import type { Pool } from 'pg';
import type { MonitoringEvent, MonitoringEventPort } from '../../../application/ports.js';

// 监控事件只负责更新调用事实，不向业务层暴露 SQL。
export class PgMonitoringEventRepository implements MonitoringEventPort {
  constructor(private readonly pool: Pool) {}

  async publish(event: MonitoringEvent): Promise<void> {
    if (event.type === 'inference.started') {
      await this.pool.query(`insert into inference_requests(request_id,user_id,api_key_id,group_id,status,started_at,model_name_snapshot,group_name_snapshot,device_name_snapshot)
        values($1,$2,$3,$4,'accepted',$5,$6,$7,$8) on conflict (request_id) do nothing`, [event.requestId, event.userId, event.apiKeyId, event.groupId, event.occurredAt, event.modelName ?? null, event.groupName ?? null, event.deviceName ?? null]);
      return;
    }
    if (event.type === 'inference.routed') {
      await this.pool.query(`update inference_requests set agent_id=$2, model_id=$3, status='routed', model_name_snapshot=coalesce(model_name_snapshot,$4), device_name_snapshot=coalesce(device_name_snapshot,$5) where request_id=$1 and finished_at is null`, [event.requestId, event.deviceId ?? null, event.modelId ?? null, event.modelName ?? null, event.deviceName ?? null]);
      return;
    }
    await this.pool.query(`update inference_requests set status=$2,status_code=$3,error_code=$4,input_tokens=$5,output_tokens=$6,total_tokens=$7,latency_ms=$8,finished_at=coalesce(finished_at,$9) where request_id=$1 and finished_at is null`, [event.requestId, event.status ?? 'failed', event.statusCode ?? 500, event.errorCode ?? null, event.inputTokens ?? null, event.outputTokens ?? null, event.totalTokens ?? (event.inputTokens == null && event.outputTokens == null ? null : (event.inputTokens ?? 0) + (event.outputTokens ?? 0)), event.latencyMs ?? null, event.occurredAt]);
  }
}
