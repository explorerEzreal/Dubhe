import type { SecurityService } from '../../application/ports.js';
import {
  digest,
  hashPassword,
  randomToken,
  signJwt,
  verifyJwt,
  verifyPassword,
} from './primitives.js';

export class HmacSecurityService implements SecurityService {
  constructor(
    private readonly jwtSecret: string,
    private readonly pepper: string,
  ) {}

  async hashPassword(value: string): Promise<string> {
    try {
      return await hashPassword(value);
    } catch (error) {
      throw error;
    }
  }

  async verifyPassword(hash: string, value: string): Promise<boolean> {
    try {
      return await verifyPassword(hash, value);
    } catch (error) {
      throw error;
    }
  }

  digest(value: string): string {
    return digest(value, this.pepper);
  }

  signSession(userId: string, role: string, ttlSeconds: number): string {
    return signJwt({ sub: userId, role }, this.jwtSecret, ttlSeconds);
  }

  verifySession(token: string): Record<string, unknown> | null {
    return verifyJwt(token, this.jwtSecret);
  }

  randomToken(prefix: string): string {
    return randomToken(prefix);
  }
}
