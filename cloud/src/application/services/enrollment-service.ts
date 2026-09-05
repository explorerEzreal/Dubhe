import type {
  AuditRepository,
  EnrollmentTokenRepository,
  SecurityService,
} from '../ports.js';

export class EnrollmentService {
  constructor(
    private readonly tokens: EnrollmentTokenRepository,
    private readonly audits: AuditRepository,
    private readonly security: SecurityService,
    private readonly ttlSeconds: number,
  ) {}

  async create(userId: string): Promise<{ token: string; expiresIn: number }> {
    try {
      const token = this.security.randomToken('dsh_enroll_');
      await this.tokens.create(
        userId,
        this.security.digest(token),
        new Date(Date.now() + this.ttlSeconds * 1000),
      );
      await this.audits.record(userId, 'enrollment.create', 'enrollment-token');
      return { token, expiresIn: this.ttlSeconds };
    } catch (error) {
      throw error;
    }
  }
}
