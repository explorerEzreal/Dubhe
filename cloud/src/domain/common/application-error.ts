// 对外只暴露稳定错误码和安全消息，不携带基础设施异常详情。
export class ApplicationError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    public readonly type: string,
    message = '请求失败，请稍后重试',
  ) {
    super(message);
    this.name = 'ApplicationError';
  }
}

export const errors = {
  invalidRequest: (code = 'INVALID_REQUEST') =>
    new ApplicationError(400, code, 'invalid_request'),
  unauthorized: () =>
    new ApplicationError(401, 'UNAUTHORIZED', 'auth_error', '未授权'),
  forbidden: (code = 'FORBIDDEN', message = '无权执行此操作') =>
    new ApplicationError(403, code, 'permission_error', message),
  notFound: () =>
    new ApplicationError(404, 'NOT_FOUND', 'not_found', '未找到'),
  conflict: () => new ApplicationError(409, 'CONFLICT', 'conflict'),
  modelNotFound: () =>
    new ApplicationError(400, 'MODEL_NOT_FOUND', 'invalid_request'),
  modelOffline: () =>
    new ApplicationError(
      503,
      'MODEL_OFFLINE',
      'service_unavailable',
      'No available agent for model',
    ),
  modelNotReady: () =>
    new ApplicationError(503, 'MODEL_NOT_READY', 'service_unavailable', 'Model is not ready'),
  agentBusy: () =>
    new ApplicationError(503, 'AGENT_BUSY', 'service_unavailable', 'All agents are busy'),
  inferenceTimeout: () =>
    new ApplicationError(504, 'INFERENCE_TIMEOUT', 'inference_error'),
  inferenceCancelled: () =>
    new ApplicationError(499, 'INFERENCE_CANCELLED', 'inference_error'),
  agentDisconnected: () =>
    new ApplicationError(503, 'AGENT_DISCONNECTED', 'service_unavailable'),
  upstreamError: () =>
    new ApplicationError(502, 'UPSTREAM_ERROR', 'upstream_error'),
};
