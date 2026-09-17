import type { Pool, PoolClient } from 'pg';
import type {
  ApiKeyCreateInput,
  ApiKeyIdentity,
  ApiKeyRepository,
} from '../../../application/ports.js';

async function rollback(client: PoolClient): Promise<void> {
  try {
    await client.query('rollback');
  } catch {
    // 保留原始事务异常。
  }
}

export class PgApiKeyRepository implements ApiKeyRepository {
  constructor(private readonly pool: Pool) {}

  async listByUser(userId: string): Promise<Array<Record<string, unknown>>> {
    try {
      const result = await this.pool.query(
        `select a.id,a.prefix,a.status,a.created_at as "createdAt",
                a.expires_at as "expiresAt", a.group_id as "groupId",
                g.name as "channelName"
           from api_keys a
           left join groups g on g.id=a.group_id
           where a.user_id=$1
           order by a.created_at desc`,
        [userId],
      );
      return result.rows as Array<Record<string, unknown>>;
    } catch (error) {
      throw error;
    }
  }

  async create(input: ApiKeyCreateInput): Promise<Record<string, unknown> | null> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      // 验证 group 存在且用户有权访问
      const groupCheck = await client.query(
        `select 1 from user_group_access where user_id=$1 and group_id=$2`,
        [input.userId, input.groupId],
      );
      if (!groupCheck.rowCount) {
        await rollback(client);
        return null;
      }
      const result = await client.query(
        `insert into api_keys(user_id,prefix,key_hash,expires_at,group_id)
         values($1,$2,$3,$4,$5)
         returning id,prefix,status,created_at as "createdAt",
                   expires_at as "expiresAt", group_id as "groupId"`,
        [input.userId, input.prefix, input.keyHash, input.expiresAt, input.groupId],
      );
      await client.query('commit');
      return result.rows[0] as Record<string, unknown>;
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async disable(userId: string, keyId: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        "update api_keys set status='disabled' where id=$1 and user_id=$2 and status<>'disabled'",
        [keyId, userId],
      );
      return Boolean(result.rowCount);
    } catch (error) {
      throw error;
    }
  }

  async delete(userId: string, keyId: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        'delete from api_keys where id=$1 and user_id=$2',
        [keyId, userId],
      );
      return Boolean(result.rowCount);
    } catch (error) {
      throw error;
    }
  }

  async authenticate(keyHash: string): Promise<ApiKeyIdentity | null> {
    try {
      const result = await this.pool.query(
        `update api_keys set last_used_at=now()
          where id=(
            select id from api_keys
             where key_hash=$1 and status='active'
               and (expires_at is null or expires_at>now())
          )
          returning id,user_id as "userId",status,expires_at as "expiresAt",
                    group_id as "groupId"`,
        [keyHash],
      );
      return (result.rows[0] as ApiKeyIdentity | undefined) ?? null;
    } catch (error) {
      throw error;
    }
  }

  async listModelsByGroup(groupId: string): Promise<Array<Record<string, unknown>>> {
    try {
      const result = await this.pool.query(
        `select distinct m.id,m.name,m.engine
           from models m
           join model_instances mi on mi.model_id=m.id
           join group_agents ga on ga.agent_id=mi.agent_id
          where ga.group_id=$1
          order by m.name`,
        [groupId],
      );
      return result.rows as Array<Record<string, unknown>>;
    } catch (error) {
      throw error;
    }
  }
}
