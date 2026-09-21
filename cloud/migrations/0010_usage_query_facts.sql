ALTER TABLE inference_requests ADD COLUMN IF NOT EXISTS group_owner_id_snapshot UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE inference_requests ADD COLUMN IF NOT EXISTS first_token_latency_ms INTEGER;
ALTER TABLE inference_requests ADD COLUMN IF NOT EXISTS reasoning_effort TEXT;
ALTER TABLE inference_requests ADD COLUMN IF NOT EXISTS stream BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_inference_requests_owner_started ON inference_requests(group_owner_id_snapshot, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_inference_requests_created_filter ON inference_requests(started_at DESC, status, model_id, agent_id, group_id);
