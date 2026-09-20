import type {
  AgentService,
  ApiKeyService,
  AuthService,
  CatalogService,
  EnrollmentService,
  GroupService,
  InferenceService,
  DeployerMonitoringQueryService,
} from '../../application/services/index.js';
import type { RateLimiter } from '../../application/ports.js';

export interface HttpServices {
  auth: AuthService;
  enrollment: EnrollmentService;
  agents: AgentService;
  apiKeys: ApiKeyService;
  catalog: CatalogService;
  groups: GroupService;
  authLimiter: RateLimiter;
  apiLimiter: RateLimiter;
  inference: InferenceService;
  monitoring: DeployerMonitoringQueryService;
}
