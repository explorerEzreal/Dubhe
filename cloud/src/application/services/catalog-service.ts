import type { CatalogRepository, UsageAnalyticsQuery, UsageRecordsQuery, UsageRecordPage } from '../ports.js';

export class CatalogService {
  constructor(private readonly catalog: CatalogRepository) {}

  async listModels(): Promise<Array<Record<string, unknown>>> {
    try {
      return await this.catalog.listModels();
    } catch (error) {
      throw error;
    }
  }

  async getUsage(userId: string): Promise<Record<string, unknown>> {
    try {
      return await this.catalog.getUsage(userId);
    } catch (error) {
      throw error;
    }
  }

  async getMonitoring(userId: string, from: Date, to: Date, scope: 'caller' | 'deployer', granularity: 'hour' | 'day' = 'day'): Promise<Record<string, unknown>> {
    try { return await this.catalog.getMonitoring(userId, from, to, scope, granularity); } catch (error) { throw error; }
  }

  async getUsageRecords(input: UsageRecordsQuery): Promise<UsageRecordPage> { return this.catalog.getUsageRecords(input); }
  async getUsageAnalytics(input: UsageAnalyticsQuery): Promise<Record<string, unknown>> { return this.catalog.getUsageAnalytics(input); }
}
