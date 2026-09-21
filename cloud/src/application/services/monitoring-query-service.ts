import type { CatalogRepository, MonitoringQueryService as MonitoringQueryPort, UsageAnalyticsQuery, UsageRecordsQuery, UsageRecordPage } from '../ports.js';

// 将底层兼容查询转换为部署者仪表盘稳定契约。
export class DeployerMonitoringQueryService implements MonitoringQueryPort {
  constructor(private readonly catalog: CatalogRepository) {}

  async getDeployerDashboard(userId: string, from: Date, to: Date, granularity: 'hour' | 'day'): Promise<Record<string, unknown>> {
    const result = await this.catalog.getMonitoring(userId, from, to, 'deployer', granularity);
    const data = result as Record<string, unknown>;
    const overview = (data.overview && typeof data.overview === 'object' ? data.overview : {}) as Record<string, unknown>;
    const devices = Array.isArray(data.agents) ? data.agents as Array<Record<string, unknown>> : [];
    const requests = Array.isArray(data.requests)
      ? data.requests.map((item) => { const row = item as Record<string, unknown>; return { ...row, deviceName: row.agentName, agentName: undefined }; })
      : [];
    const publicData = { ...data };
    delete publicData.agents;
    return {
      ...publicData,
      overview: { ...overview, activeDevices: Number(overview.activeDevices ?? devices.length), totalDevices: Number(overview.totalDevices ?? devices.length) },
      devices,
      requests,
      trend: Array.isArray(data.trend) ? data.trend.map((item) => { const row = item as Record<string, unknown>; return { ...row, errorRate: Number(row.errorRate ?? 0) }; }) : [],
      dataQuality: { missingTokenCalls: Number((data.dataQuality as Record<string, unknown> | undefined)?.missingTokenCalls ?? overview.missingTokenCalls ?? 0), ungroupedCalls: Number((data.dataQuality as Record<string, unknown> | undefined)?.ungroupedCalls ?? 0), truncated: Boolean((data.dataQuality as Record<string, unknown> | undefined)?.truncated) },
      generatedAt: new Date().toISOString(),
      granularity,
    };
  }
}

export class UsageQueryService {
  constructor(private readonly catalog: CatalogRepository) {}
  async records(input: UsageRecordsQuery): Promise<UsageRecordPage> { return this.catalog.getUsageRecords(input); }
  async analytics(input: UsageAnalyticsQuery): Promise<Record<string, unknown>> { return this.catalog.getUsageAnalytics(input); }
}
