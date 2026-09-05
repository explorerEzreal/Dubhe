import type {
  AgentService,
  ApiKeyService,
  AuthService,
  CatalogService,
  EnrollmentService,
  InferenceService,
} from '../../application/services/index.js';
import type { RateLimiter } from '../../application/ports.js';

export interface HttpServices {
  auth: AuthService;
  enrollment: EnrollmentService;
  agents: AgentService;
  apiKeys: ApiKeyService;
  catalog: CatalogService;
  authLimiter: RateLimiter;
  apiLimiter: RateLimiter;
  inference: InferenceService;
}
