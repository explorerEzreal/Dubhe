export interface ApiKeyRecord {
  id: string;
  userId: string;
  prefix: string;
  status: 'active' | 'disabled';
  expiresAt?: Date;
  lastUsedAt?: Date;
}
