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
        'select id,prefix,status,created_at as "createdAt",expires_at as "expiresAt" from api_keys where user_id=$1 order by created_at desc',
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
      const modelNames = [...new Set(input.modelNames)];
      if (modelNames.length) {
        const models = await client.query(
          'select name from models where name=any($1::text[])',
          [modelNames],
        );
        if (models.rowCount !== modelNames.length) {
          await rollback(client);
          return null;
        }
      }
      const result = await client.query(
        'insert into api_keys(user_id,prefix,key_hash,expires_at) values($1,$2,$3,$4) returning id,prefix,status,created_at as "createdAt",expires_at as "expiresAt"',
        [input.userId, input.prefix, input.keyHash, input.expiresAt],
      );
      if (modelNames.length) {
        await client.query(
          'insert into api_key_model_permissions(api_key_id,model_id) select $1,id from models where name=any($2::text[])',
          [result.rows[0].id, modelNames],
        );
      } else {
        await client.query(
          'insert into api_key_model_permissions(api_key_id,model_id) select $1,id from models',
          [result.rows[0].id],
        );
      }
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
        "update api_keys set last_used_at=now() where id=(select id from api_keys where key_hash=$1 and status='active' and (expires_at is null or expires_at>now())) returning id,user_id as \"userId\",status,expires_at as \"expiresAt\"",
        [keyHash],
      );
      return (result.rows[0] as ApiKeyIdentity | undefined) ?? null;
    } catch (error) {
      throw error;
    }
  }

  async listPermittedModels(keyId: string): Promise<Array<Record<string, unknown>>> {
    try {
      const result = await this.pool.query(
        'select distinct m.id,m.name,m.engine from models m join api_key_model_permissions p on p.model_id=m.id where p.api_key_id=$1 order by m.name',
        [keyId],
      );
      return result.rows as Array<Record<string, unknown>>;
    } catch (error) {
      throw error;
    }
  }

  async hasModelPermission(keyId: string, modelName: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        'select 1 from api_key_model_permissions p join models m on m.id=p.model_id where p.api_key_id=$1 and m.name=$2',
        [keyId, modelName],
      );
      return Boolean(result.rowCount);
    } catch (error) {
      throw error;
    }
  }
}
