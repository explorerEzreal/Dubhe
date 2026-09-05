import { describe, expect, it } from 'vitest';
import type {
  ApiKeyCreateInput,
  ApiKeyIdentity,
  ApiKeyRepository,
  AuditRepository,
  SecurityService,
} from '../../src/application/ports.js';
import { ApiKeyService } from '../../src/application/services/api-key-service.js';

class FakeKeys implements ApiKeyRepository {
  created?: ApiKeyCreateInput;
  existing = true;

  async listByUser(): Promise<Array<Record<string, unknown>>> {
    try {
      return [];
    } catch (error) {
      throw error;
    }
  }

  async create(input: ApiKeyCreateInput): Promise<Record<string, unknown> | null> {
    try {
      this.created = input;
      return this.existing ? { id: 'key-1', prefix: input.prefix } : null;
    } catch (error) {
      throw error;
    }
  }

  async disable(): Promise<boolean> {
    try {
      return this.existing;
    } catch (error) {
      throw error;
    }
  }

  async delete(): Promise<boolean> {
    try {
      return this.existing;
    } catch (error) {
      throw error;
    }
  }

  async authenticate(): Promise<ApiKeyIdentity | null> {
    try {
      return this.existing
        ? { id: 'key-1', userId: 'user-1', status: 'active', expiresAt: null }
        : null;
    } catch (error) {
      throw error;
    }
  }

  async listPermittedModels(): Promise<Array<Record<string, unknown>>> {
    try {
      return [];
    } catch (error) {
      throw error;
    }
  }

  async hasModelPermission(): Promise<boolean> {
    try {
      return this.existing;
    } catch (error) {
      throw error;
    }
  }
}

const security: SecurityService = {
  hashPassword: async (value) => value,
  verifyPassword: async () => true,
  digest: (value) => `digest:${value}`,
  signSession: () => 'jwt',
  verifySession: () => null,
  randomToken: (prefix) => `${prefix}plaintext-secret`,
};

class FakeAudits implements AuditRepository {
  entries: Array<{ action: string; resource: string }> = [];

  async record(_actorId: string | null, action: string, resource: string): Promise<void> {
    try {
      this.entries.push({ action, resource });
    } catch (error) {
      throw error;
    }
  }
}

describe('ApiKeyService', () => {
  it('stores only the HMAC digest and returns plaintext once', async () => {
    const keys = new FakeKeys();
    const audits = new FakeAudits();
    const service = new ApiKeyService(keys, audits, security);
    const result = await service.create('user-1', ['llama3:8b'], null);

    expect(result.plaintext).toBe('dsh_live_plaintext-secret');
    expect(keys.created?.keyHash).toBe('digest:dsh_live_plaintext-secret');
    expect(JSON.stringify(keys.created)).not.toContain('"plaintext"');
    expect(JSON.stringify(audits.entries)).not.toContain('plaintext-secret');
  });

  it('rejects unknown models, past expiration and missing keys', async () => {
    const keys = new FakeKeys();
    const service = new ApiKeyService(keys, new FakeAudits(), security);
    keys.existing = false;
    await expect(service.create('user-1', ['unknown'], null)).rejects.toMatchObject({
      code: 'MODEL_NOT_FOUND',
    });
    await expect(
      service.create('user-1', [], new Date('2000-01-01T00:00:00Z')),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(service.disable('user-1', 'key-1')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
