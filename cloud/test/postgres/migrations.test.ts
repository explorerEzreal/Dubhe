import crypto from 'node:crypto';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runMigrations } from '../../src/infrastructure/database/migrator.js';
import {
  PgAgentRepository,
  PgApiKeyRepository,
  PgAuditRepository,
  PgEnrollmentTokenRepository,
  PgSessionRepository,
  PgUserRepository,
} from '../../src/infrastructure/database/repositories.js';
import { HmacSecurityService } from '../../src/infrastructure/security/index.js';
import {
  AgentService,
  ApiKeyService,
  AuthService,
  EnrollmentService,
} from '../../src/application/services/index.js';
import type { ConnectionRegistry } from '../../src/application/ports.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const run = databaseUrl ? describe : describe.skip;

run('PostgreSQL migrations', () => {
  const schema = `m2_${crypto.randomBytes(8).toString('hex')}`;
  let admin: Pool;
  let scoped: Pool;

  beforeAll(async () => {
    try {
      admin = new Pool({ connectionString: databaseUrl });
      await admin.query(`create schema "${schema}"`);
      scoped = new Pool({
        connectionString: databaseUrl,
        options: `-c search_path=${schema}`,
      });
    } catch (error) {
      throw error;
    }
  });

  afterAll(async () => {
    try {
      await scoped?.end();
      await admin?.query(`drop schema if exists "${schema}" cascade`);
      await admin?.end();
    } catch (error) {
      throw error;
    }
  });

  it('applies all migrations once and preserves required fields and indexes', async () => {
    try {
      const directory = resolve(process.cwd(), 'migrations');
      expect(await runMigrations(scoped, directory)).toEqual([
        '0001_initial.sql',
        '0002_security.sql',
        '0003_token_hardening.sql',
      ]);
      expect(await runMigrations(scoped, directory)).toEqual([]);

      const columns = await scoped.query(
        "select table_name,column_name from information_schema.columns where table_schema=$1 and ((table_name='sessions' and column_name in ('revoked_at','last_used_at')) or (table_name='agent_credentials' and column_name in ('revoked_at','replaced_by')))",
        [schema],
      );
      expect(columns.rowCount).toBe(4);
      const indexes = await scoped.query(
        "select indexname from pg_indexes where schemaname=$1 and indexname in ('idx_sessions_token_active','idx_agent_credentials_active','idx_audit_logs_actor_created','idx_audit_logs_action_created','idx_audit_logs_resource_created')",
        [schema],
      );
      expect(indexes.rowCount).toBe(5);
    } catch (error) {
      throw error;
    }
  });

  it('persists only credential digests and enforces revocation and permissions', async () => {
    try {
      const security = new HmacSecurityService(
        'test-jwt-secret-with-at-least-32-characters',
        'test-api-pepper-with-at-least-32-characters',
      );
      const audits = new PgAuditRepository(scoped);
      const sessions = new PgSessionRepository(scoped);
      const auth = new AuthService(
        new PgUserRepository(scoped),
        sessions,
        audits,
        security,
        3600,
      );
      const enrollment = new EnrollmentService(
        new PgEnrollmentTokenRepository(scoped),
        audits,
        security,
        900,
      );
      const closedAgents: string[] = [];
      const connections: ConnectionRegistry = {
        add: () => undefined,
        remove: () => false,
        closeAgent: (agentId) => closedAgents.push(agentId),
        get: () => undefined,
        touch: () => undefined,
        getStale: () => [],
      };
      const agents = new AgentService(
        new PgAgentRepository(scoped),
        audits,
        connections,
        security,
      );
      const keys = new ApiKeyService(
        new PgApiKeyRepository(scoped),
        audits,
        security,
      );

      const session = await auth.register(
        `m2-${crypto.randomUUID()}@example.com`,
        'test-password',
      );
      await expect(auth.authenticate(session.token)).resolves.toMatchObject({
        id: session.user.id,
      });
      const enrollmentToken = await enrollment.create(session.user.id);
      const registered = await agents.register({
        token: enrollmentToken.token,
        deviceId: crypto.randomUUID(),
        name: 'M2 Agent',
        hardwareInfo: { cpu: 'test' },
      });
      await agents.heartbeat(registered.agentId, {
        status: 'degraded',
        hardwareInfo: { cpu: 'updated' },
        models: [{ name: 'llama3:8b', state: 'ready' }],
      });
      expect(
        (await scoped.query('select status from agents where id=$1', [registered.agentId])).rows[0],
      ).toMatchObject({ status: 'degraded' });
      await agents.markOffline(registered.agentId);
      expect(
        (await scoped.query('select status from agents where id=$1', [registered.agentId])).rows[0],
      ).toMatchObject({ status: 'offline' });
      expect(
        (await scoped.query('select state from model_instances where agent_id=$1', [registered.agentId])).rows[0],
      ).toMatchObject({ state: 'offline' });
      await agents.heartbeat(registered.agentId, {
        status: 'online',
        models: [{ name: 'llama3:8b', state: 'ready' }],
      });
      expect(
        (await scoped.query('select status from agents where id=$1', [registered.agentId])).rows[0],
      ).toMatchObject({ status: 'online' });
      await expect(
        agents.register({
          token: enrollmentToken.token,
          deviceId: crypto.randomUUID(),
          name: '重复注册',
          hardwareInfo: null,
        }),
      ).rejects.toMatchObject({ statusCode: 401 });

      await scoped.query(
        "insert into models(name) values('llama3:8b') on conflict do nothing",
      );
      const apiKey = await keys.create(
        session.user.id,
        ['llama3:8b'],
        new Date(Date.now() + 3600_000),
      );
      await expect(
        keys.authenticate(String(apiKey.plaintext)),
      ).resolves.toMatchObject({ id: apiKey.id });
      await keys.disable(session.user.id, String(apiKey.id));
      await expect(keys.authenticate(String(apiKey.plaintext))).rejects.toMatchObject({
        statusCode: 401,
      });

      const rotated = await agents.rotateCredential(
        session.user.id,
        registered.agentId,
      );
      await agents.revokeCredentials(session.user.id, registered.agentId);
      await agents.markOffline(registered.agentId);
      expect(
        (await scoped.query('select status from agents where id=$1', [registered.agentId])).rows[0],
      ).toMatchObject({ status: 'revoked' });
      await expect(
        agents.authenticateCredential(rotated.credential),
      ).rejects.toMatchObject({ statusCode: 401 });
      await auth.logout(session.token);
      await expect(auth.authenticate(session.token)).rejects.toMatchObject({
        statusCode: 401,
      });

      const persisted = JSON.stringify(
        (
          await scoped.query(
            'select token_hash from sessions union all select token_hash from enrollment_tokens union all select cred_hash from agent_credentials union all select key_hash from api_keys',
          )
        ).rows,
      );
      expect(persisted).not.toContain(session.token);
      expect(persisted).not.toContain(enrollmentToken.token);
      expect(persisted).not.toContain(registered.credential);
      expect(persisted).not.toContain(String(apiKey.plaintext));
      const auditBody = JSON.stringify(
        (await scoped.query('select action,resource from audit_logs')).rows,
      );
      expect(auditBody).not.toContain('dsh_');
      expect(closedAgents).toContain(registered.agentId);
    } catch (error) {
      throw error;
    }
  }, 20_000);
});
