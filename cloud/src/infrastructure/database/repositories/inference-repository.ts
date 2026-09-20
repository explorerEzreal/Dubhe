import type { Pool } from 'pg';
import type {
  InferenceCreateInput,
  InferenceFinishInput,
  InferenceRepository,
  InferenceRouteInput,
  InferenceSnapshot,
  ModelRouteCandidate,
} from '../../../application/ports.js';

export class PgInferenceRepository implements InferenceRepository {
  constructor(private readonly pool: Pool) {}

  async getSnapshot(groupId: string | null, modelName: string): Promise<InferenceSnapshot> {
    try {
      const result = await this.pool.query(
        `select m.id as "modelId", m.name as "modelName",
                mi.agent_id as "agentId", a.status as "agentStatus",
                mi.state, mi.max_concurrency as "maxConcurrency",
                coalesce(mi.last_ready_at, mi.updated_at) as "lastUsedAt"
           from models m
           join model_instances mi on mi.model_id=m.id
           join agents a on a.id=mi.agent_id
           ${groupId ? 'join group_agents ga on ga.agent_id=mi.agent_id and ga.group_id=$2' : ''}
          where m.name=$1
          order by mi.updated_at asc nulls first`,
        groupId ? [modelName, groupId] : [modelName],
      );
      if (!result.rowCount) return { modelExists: true, instances: [] };
      const instances = result.rows
        .filter((row) => row.agentId !== null)
        .map((row) => ({
          modelId: String(row.modelId),
          modelName: String(row.modelName),
          agentId: String(row.agentId),
          agentStatus: String(row.agentStatus) as ModelRouteCandidate['agentStatus'],
          state: String(row.state) as ModelRouteCandidate['state'],
          maxConcurrency: Number(row.maxConcurrency),
          lastUsedAt: new Date(row.lastUsedAt),
        }));
      return { modelExists: true, instances };
    } catch (error) {
      throw error;
    }
  }

  async createAccepted(input: InferenceCreateInput): Promise<void> {
    try {
      await this.pool.query(
        `insert into inference_requests(request_id,user_id,api_key_id,group_id,status)
         values($1,$2,$3,$4,'accepted')
         on conflict (request_id) do nothing`,
        [input.requestId, input.userId, input.apiKeyId, input.groupId],
      );
    } catch (error) {
      throw error;
    }
  }

  async markRouted(input: InferenceRouteInput): Promise<void> {
    try {
      await this.pool.query(
        `update inference_requests
            set agent_id=$2, model_id=$3, status='routed'
          where request_id=$1`,
        [input.requestId, input.agentId, input.modelId],
      );
    } catch (error) {
      throw error;
    }
  }

  async finish(requestId: string, input: InferenceFinishInput): Promise<void> {
    try {
      await this.pool.query(
        `update inference_requests
            set status=$2, status_code=$3, error_code=$4,
                input_tokens=$5, output_tokens=$6, total_tokens=$7, latency_ms=$8,
                finished_at=now()
          where request_id=$1 and finished_at is null`,
        [
          requestId,
          input.status,
          input.statusCode,
          input.errorCode ?? null,
          input.inputTokens ?? null,
          input.outputTokens ?? null,
          input.totalTokens ?? (input.inputTokens == null && input.outputTokens == null
            ? null
            : (input.inputTokens ?? 0) + (input.outputTokens ?? 0)),
          input.latencyMs,
        ],
      );
    } catch (error) {
      throw error;
    }
  }
}
