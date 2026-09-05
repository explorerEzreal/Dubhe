import type { Pool, PoolClient } from 'pg';
import type {
  AgentHeartbeatInput,
  AgentIdentity,
  AgentRegistrationInput,
  AgentRegistrationResult,
  AgentRepository,
} from '../../../application/ports.js';

async function rollback(client: PoolClient): Promise<void> {
  try {
    await client.query('rollback');
  } catch {
    // 保留原始事务异常。
  }
}

export class PgAgentRepository implements AgentRepository {
  constructor(private readonly pool: Pool) {}

  async listByUser(userId: string): Promise<Array<Record<string, unknown>>> {
    try {
      const result = await this.pool.query(
        `select
           a.id,
           a.name,
           a.status,
           a.last_seen_at as "lastSeenAt",
           a.hardware_info as "hardwareInfo",
           coalesce((
             select json_agg(json_build_object(
               'name', m.name,
               'engine', m.engine,
               'state', mi.state,
               'maxConcurrency', mi.max_concurrency,
               'lastError', mi.last_error,
               'lastReadyAt', mi.last_ready_at
             ) order by m.name)
             from model_instances mi
             join models m on m.id=mi.model_id
             where mi.agent_id=a.id
           ), '[]'::json) as "modelInstances"
         from agents a
         where a.user_id=$1
         order by a.created_at desc`,
        [userId],
      );
      return result.rows as Array<Record<string, unknown>>;
    } catch (error) {
      throw error;
    }
  }

  async findByUser(userId: string, agentId: string): Promise<Record<string, unknown> | null> {
    try {
      const result = await this.pool.query(
        `select
           a.id,
           a.name,
           a.status,
           a.last_seen_at as "lastSeenAt",
           a.hardware_info as "hardwareInfo",
           coalesce((
             select json_agg(json_build_object(
               'name', m.name,
               'engine', m.engine,
               'state', mi.state,
               'maxConcurrency', mi.max_concurrency,
               'lastError', mi.last_error,
               'lastReadyAt', mi.last_ready_at
             ) order by m.name)
             from model_instances mi
             join models m on m.id=mi.model_id
             where mi.agent_id=a.id
           ), '[]'::json) as "modelInstances"
         from agents a
         where a.id=$1 and a.user_id=$2`,
        [agentId, userId],
      );
      return (result.rows[0] as Record<string, unknown> | undefined) ?? null;
    } catch (error) {
      throw error;
    }
  }

  async authenticateCredential(credentialHash: string): Promise<AgentIdentity | null> {
    try {
      const result = await this.pool.query(
        "select a.id,a.user_id as \"userId\",a.status from agent_credentials c join agents a on a.id=c.agent_id where c.cred_hash=$1 and c.revoked=false and c.revoked_at is null and a.status<>'revoked'",
        [credentialHash],
      );
      return (result.rows[0] as AgentIdentity | undefined) ?? null;
    } catch (error) {
      throw error;
    }
  }

  async register(input: AgentRegistrationInput): Promise<AgentRegistrationResult | null> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const enrollment = await client.query(
        'select id,user_id from enrollment_tokens where token_hash=$1 and used=false and revoked_at is null and expires_at>now() for update',
        [input.tokenHash],
      );
      if (!enrollment.rowCount) {
        await rollback(client);
        return null;
      }
      const agent = await client.query(
        "insert into agents(user_id,device_id,name,status,hardware_info,last_seen_at) values($1,$2,$3,'online',$4,now()) on conflict(device_id) do update set status='online',last_seen_at=now(),updated_at=now(),name=excluded.name,hardware_info=excluded.hardware_info where agents.user_id=excluded.user_id returning id,user_id as \"userId\"",
        [
          enrollment.rows[0].user_id,
          input.deviceId,
          input.name,
          input.hardwareInfo,
        ],
      );
      if (!agent.rowCount) {
        await rollback(client);
        return null;
      }
      await client.query(
        'update enrollment_tokens set used=true,used_at=now() where id=$1',
        [enrollment.rows[0].id],
      );
      await client.query(
        'update agent_credentials set revoked=true,revoked_at=now() where agent_id=$1 and revoked=false',
        [agent.rows[0].id],
      );
      await client.query(
        'insert into agent_credentials(agent_id,cred_hash) values($1,$2)',
        [agent.rows[0].id, input.credentialHash],
      );
      await client.query('commit');
      return {
        agentId: String(agent.rows[0].id),
        userId: String(agent.rows[0].userId),
      };
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async rotateCredential(
    userId: string,
    agentId: string,
    credentialHash: string,
  ): Promise<number | null> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const agent = await client.query(
        "select id from agents where id=$1 and user_id=$2 and status<>'revoked' for update",
        [agentId, userId],
      );
      if (!agent.rowCount) {
        await rollback(client);
        return null;
      }
      const old = await client.query(
        'select id from agent_credentials where agent_id=$1 and revoked=false and revoked_at is null',
        [agentId],
      );
      const inserted = await client.query(
        'insert into agent_credentials(agent_id,cred_hash) values($1,$2) returning id',
        [agentId, credentialHash],
      );
      await client.query(
        'update agent_credentials set revoked=true,revoked_at=now(),replaced_by=$2 where agent_id=$1 and revoked=false and id<>$2',
        [agentId, inserted.rows[0].id],
      );
      await client.query('commit');
      return old.rowCount ?? 0;
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async revokeCredentials(userId: string, agentId: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const agent = await client.query(
        "update agents set status='revoked',updated_at=now() where id=$1 and user_id=$2 and status<>'revoked' returning id",
        [agentId, userId],
      );
      if (!agent.rowCount) {
        await rollback(client);
        return false;
      }
      await client.query(
        'update agent_credentials set revoked=true,revoked_at=now() where agent_id=$1 and revoked=false',
        [agentId],
      );
      await client.query('commit');
      return true;
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async heartbeat(agentId: string, input: AgentHeartbeatInput): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const agent = await client.query(
        "update agents set status=$2,last_seen_at=now(),hardware_info=coalesce($3,hardware_info),updated_at=now() where id=$1 and status<>'revoked' returning id",
        [agentId, input.status, input.hardwareInfo ?? null],
      );
      if (!agent.rowCount) {
        await rollback(client);
        return;
      }
      await client.query(
        "update model_instances set state='offline',updated_at=now() where agent_id=$1",
        [agentId],
      );
      for (const model of input.models) {
        await client.query(
          'insert into models(name) values($1) on conflict do nothing',
          [model.name],
        );
        await client.query(
          "insert into model_instances(agent_id,model_id,state,last_ready_at) select $1,id,$3,case when $3='ready' then now() else null end from models where name=$2 on conflict(agent_id,model_id) do update set state=excluded.state,last_ready_at=case when excluded.state='ready' then now() else model_instances.last_ready_at end,updated_at=now()",
          [agentId, model.name, model.state],
        );
      }
      await client.query('commit');
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async markOffline(agentId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const agent = await client.query(
        "update agents set status='offline',updated_at=now() where id=$1 and status<>'revoked' returning id",
        [agentId],
      );
      if (agent.rowCount) {
        await client.query(
          "update model_instances set state='offline',updated_at=now() where agent_id=$1",
          [agentId],
        );
      }
      await client.query('commit');
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }
}
