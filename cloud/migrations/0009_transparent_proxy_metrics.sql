ALTER TABLE inference_requests ADD COLUMN IF NOT EXISTS endpoint TEXT;
ALTER TABLE inference_requests ADD COLUMN IF NOT EXISTS request_bytes BIGINT;
ALTER TABLE inference_requests ADD COLUMN IF NOT EXISTS response_bytes BIGINT;
ALTER TABLE inference_requests ADD COLUMN IF NOT EXISTS upstream_status_code INTEGER;
ALTER TABLE inference_requests ADD COLUMN IF NOT EXISTS usage_available BOOLEAN;
ALTER TABLE inference_requests ADD COLUMN IF NOT EXISTS usage_source TEXT;
ALTER TABLE inference_requests ADD COLUMN IF NOT EXISTS upstream_latency_ms INTEGER;
CREATE INDEX IF NOT EXISTS idx_inference_requests_endpoint_started ON inference_requests(endpoint, started_at DESC);
