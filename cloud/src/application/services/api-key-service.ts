import type {
  ApiKeyIdentity,
  ApiKeyRepository,
  AuditRepository,
  SecurityService,
} from '../ports.js';
import { errors } from '../../domain/common/index.js';

export class ApiKeyService {
  constructor(
    private readonly keys: ApiKeyRepository,
    private readonly audits: AuditRepository,
    private readonly security: SecurityService,
  ) {}

  async list(userId: string): Promise<Array<Record<string, unknown>>> {
    try {
      return await this.keys.listByUser(userId);
    } catch (error) {
      throw error;
    }
  }

  async create(
    userId: string,
    groupId: string,
    expiresAt: Date | null,
  ): Promise<Record<string, unknown>> {
    try {
      if (expiresAt && expiresAt <= new Date()) throw errors.invalidRequest();
      const plaintext = this.security.randomToken('dsh_live_');
      const created = await this.keys.create({
        userId,
        prefix: plaintext.slice(0, 14),
        keyHash: this.security.digest(plaintext),
        expiresAt,
        groupId,
      });
      if (!created) throw errors.invalidRequest('INVALID_CHANNEL', '渠道无效或无权访问');
      await this.audits.record(
        userId,
        'api-key.create',
        `api-key:${String(created.id)}`,
      );
      return { ...created, plaintext };
    } catch (error) {
      throw error;
    }
  }

  async disable(userId: string, keyId: string): Promise<void> {
    try {
      if (!(await this.keys.disable(userId, keyId))) throw errors.notFound();
      await this.audits.record(userId, 'api-key.disable', `api-key:${keyId}`);
    } catch (error) {
      throw error;
    }
  }

  async delete(userId: string, keyId: string): Promise<void> {
    try {
      if (!(await this.keys.delete(userId, keyId))) throw errors.notFound();
      await this.audits.record(userId, 'api-key.delete', `api-key:${keyId}`);
    } catch (error) {
      throw error;
    }
  }

  async authenticate(plaintext: string): Promise<ApiKeyIdentity> {
    try {
      const key = await this.keys.authenticate(this.security.digest(plaintext));
      if (!key) throw errors.unauthorized();
      return key;
    } catch (error) {
      throw error;
    }
  }

  async listModelsByGroup(groupId: string): Promise<Array<Record<string, unknown>>> {
    try {
      return await this.keys.listModelsByGroup(groupId);
    } catch (error) {
      throw error;
    }
  }
}
