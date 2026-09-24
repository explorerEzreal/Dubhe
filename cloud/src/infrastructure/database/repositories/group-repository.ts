import type { Pool } from 'pg';
import type { GroupRepository } from '../../../application/ports.js';

export class PgGroupRepository implements GroupRepository {
  constructor(private readonly pool: Pool) {}

  async create(userId: string, name: string, description: string | null): Promise<Record<string, unknown>> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const group = await client.query(
        `insert into groups(user_id,name,description)
         values($1,$2,$3)
         returning id,user_id as "userId",name,description,created_at as "createdAt"`,
        [userId, name, description],
      );
      // 创建者自动获得渠道访问权限
      await client.query(
        `insert into user_group_access(user_id,group_id,source)
         values($1,$2,'owner')`,
        [userId, group.rows[0].id],
      );
      await client.query('commit');
      return group.rows[0] as Record<string, unknown>;
    } catch (error) {
      await client.query('rollback').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async listByOwner(userId: string): Promise<Array<Record<string, unknown>>> {
    try {
      const result = await this.pool.query(
        `select g.id,g.name,g.description,g.created_at as "createdAt",
                g.updated_at as "updatedAt",
                (select count(*) from group_agents where group_id=g.id)::int as "agentCount"
           from groups g
          where g.user_id=$1 and g.deleted_at is null
          order by g.created_at desc`,
        [userId],
      );
      return result.rows as Array<Record<string, unknown>>;
    } catch (error) {
      throw error;
    }
  }

  async getById(groupId: string): Promise<Record<string, unknown> | null> {
    try {
      const result = await this.pool.query(
        `select g.id,g.user_id as "userId",g.name,g.description,
                g.created_at as "createdAt",g.updated_at as "updatedAt",
                g.deleted_at as "deletedAt"
           from groups g
          where g.id=$1`,
        [groupId],
      );
      return (result.rows[0] as Record<string, unknown> | undefined) ?? null;
    } catch (error) {
      throw error;
    }
  }

  async update(groupId: string, name: string, description: string | null): Promise<boolean> {
    try {
      const result = await this.pool.query(
        `update groups set name=$2,description=$3,updated_at=now()
          where id=$1`,
        [groupId, name, description],
      );
      return Boolean(result.rowCount);
    } catch (error) {
      throw error;
    }
  }

  async delete(groupId: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        'update groups set deleted_at=coalesce(deleted_at,now()), updated_at=now() where id=$1 and deleted_at is null',
        [groupId],
      );
      return Boolean(result.rowCount);
    } catch (error) {
      throw error;
    }
  }

  async addAgent(groupId: string, agentId: string): Promise<void> {
    try {
      await this.pool.query(
        'insert into group_agents(group_id,agent_id) values($1,$2) on conflict do nothing',
        [groupId, agentId],
      );
    } catch (error) {
      throw error;
    }
  }

  async removeAgent(groupId: string, agentId: string): Promise<void> {
    try {
      await this.pool.query(
        'delete from group_agents where group_id=$1 and agent_id=$2',
        [groupId, agentId],
      );
    } catch (error) {
      throw error;
    }
  }

  async listAgentsByGroup(groupId: string): Promise<Array<Record<string, unknown>>> {
    try {
      const result = await this.pool.query(
        `select a.id,coalesce(nullif(a.name, ''), a.device_id) as name,a.status,
                case a.status when 'offline' then 'heartbeat_timeout' when 'revoked' then 'credential_revoked' when 'created' then 'not_registered' when 'degraded' then 'model_unavailable' else 'heartbeat' end as "statusReason",
                a.last_seen_at as "lastSeenAt", a.last_seen_at as "resourceSnapshotAt",
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
                ),'[]'::json) as "modelInstances"
           from agents a
           join group_agents ga on ga.agent_id=a.id
          where ga.group_id=$1
          order by a.name`,
        [groupId],
      );
      return result.rows as Array<Record<string, unknown>>;
    } catch (error) {
      throw error;
    }
  }

  async countApiKeys(groupId: string): Promise<number> {
    try {
      const result = await this.pool.query(
        "select count(*)::int as cnt from api_keys where group_id=$1 and status='active'",
        [groupId],
      );
      return result.rows[0].cnt as number;
    } catch (error) {
      throw error;
    }
  }

  // 渠道方法
  async addAccess(userId: string, groupId: string, source: string): Promise<void> {
    try {
      await this.pool.query(
        `insert into user_group_access(user_id,group_id,source)
         values($1,$2,$3) on conflict (user_id,group_id) do nothing`,
        [userId, groupId, source],
      );
    } catch (error) {
      throw error;
    }
  }

  async removeAccess(userId: string, accessId: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        'delete from user_group_access where id=$1 and user_id=$2',
        [accessId, userId],
      );
      return Boolean(result.rowCount);
    } catch (error) {
      throw error;
    }
  }

  async listAccessByUser(userId: string): Promise<Array<Record<string, unknown>>> {
    try {
      const result = await this.pool.query(
        `select a.id as "accessId",a.user_id as "userId",a.group_id as "groupId",
                a.source,a.created_at as "createdAt",
                g.name as "channelName",g.description as "channelDescription",
                (select count(*) from group_agents where group_id=g.id)::int as "agentCount",
                (select count(distinct mi.model_id) from group_agents ga2
                   join model_instances mi on mi.agent_id=ga2.agent_id
                  where ga2.group_id=g.id)::int as "modelCount",
                case
                  when (select count(*) from group_agents ga3 join agents a3 on a3.id=ga3.agent_id
                        join model_instances mi3 on mi3.agent_id=a3.id
                       where ga3.group_id=g.id and a3.status='online' and mi3.state='ready') > 0
                   and (select count(*) from group_agents ga4 join model_instances mi4 on mi4.agent_id=ga4.agent_id
                       where ga4.group_id=g.id) =
                       (select count(*) from group_agents ga5 join agents a5 on a5.id=ga5.agent_id
                        join model_instances mi5 on mi5.agent_id=a5.id
                       where ga5.group_id=g.id and a5.status='online' and mi5.state='ready')
                    then 'available'
                  when (select count(*) from group_agents ga6 join agents a6 on a6.id=ga6.agent_id
                        join model_instances mi6 on mi6.agent_id=a6.id
                       where ga6.group_id=g.id and a6.status='online' and mi6.state='ready') > 0
                    then 'partial'
                  else 'offline'
                end as status,
                coalesce((select sum(ir.total_tokens) from inference_requests ir
                   where ir.group_id=g.id and ir.user_id=a.user_id
                     and ir.started_at >= current_date),0)::float as "todayTokens",
                coalesce((select sum(ir.total_tokens) from inference_requests ir
                   where ir.group_id=g.id and ir.user_id=a.user_id
                     and ir.started_at >= current_date - interval '30 days'),0)::float as "last30dTokens",
                (select max(ir.started_at) from inference_requests ir
                   where ir.group_id=g.id and ir.user_id=a.user_id) as "lastActiveAt"
           from user_group_access a
           join groups g on g.id=a.group_id
          where a.user_id=$1
          order by a.created_at desc`,
        [userId],
      );
      return result.rows as Array<Record<string, unknown>>;
    } catch (error) {
      throw error;
    }
  }

  async hasAccess(userId: string, groupId: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        'select 1 from user_group_access where user_id=$1 and group_id=$2',
        [userId, groupId],
      );
      return Boolean(result.rowCount);
    } catch (error) {
      throw error;
    }
  }

  async getAccessById(accessId: string): Promise<Record<string, unknown> | null> {
    try {
      const result = await this.pool.query(
        `select a.id as "accessId",a.user_id as "userId",a.group_id as "groupId",
                a.source,a.created_at as "createdAt",
                g.name as "channelName"
           from user_group_access a
           join groups g on g.id=a.group_id
          where a.id=$1`,
        [accessId],
      );
      return (result.rows[0] as Record<string, unknown> | undefined) ?? null;
    } catch (error) {
      throw error;
    }
  }

  async createInvite(groupId: string, issuerId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.pool.query('insert into group_invites(group_id,issuer_id,token_hash,expires_at) values($1,$2,$3,$4)', [groupId, issuerId, tokenHash, expiresAt]);
  }

  async consumeInvite(tokenHash: string): Promise<{ groupId: string; issuerId: string } | null> {
    const result = await this.pool.query(`select group_id as "groupId", issuer_id as "issuerId" from group_invites where token_hash=$1 and revoked_at is null and expires_at>now()`, [tokenHash]);
    return (result.rows[0] as { groupId: string; issuerId: string } | undefined) ?? null;
  }

  async revokeInvites(groupId: string): Promise<void> {
    await this.pool.query('update group_invites set revoked_at=coalesce(revoked_at,now()) where group_id=$1 and revoked_at is null', [groupId]);
  }
}
