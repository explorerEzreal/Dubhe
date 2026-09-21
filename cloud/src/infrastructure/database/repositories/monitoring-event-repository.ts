import type { Pool } from 'pg';
import type { MonitoringEvent, MonitoringEventPort } from '../../../application/ports.js';

// 监控事件只负责更新调用事实，不向业务层暴露 SQL。
export class PgMonitoringEventRepository implements MonitoringEventPort {
  constructor(private readonly pool: Pool) {}

  async publish(event: MonitoringEvent): Promise<void> {
    // 事实表由 PgInferenceRepository 唯一写入；事件端口保留为审计/通知扩展点。
    void event;
  }
}
