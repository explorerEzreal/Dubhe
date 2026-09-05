// 用例：采集最小系统指标并随心跳上报。采集失败不能阻塞推理链路。
export interface MetricsService {
  collect(): Promise<Record<string, unknown>>;
}
