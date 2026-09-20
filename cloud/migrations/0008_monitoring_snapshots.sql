ALTER TABLE inference_requests ADD COLUMN IF NOT EXISTS model_name_snapshot TEXT;
ALTER TABLE inference_requests ADD COLUMN IF NOT EXISTS group_name_snapshot TEXT;
ALTER TABLE inference_requests ADD COLUMN IF NOT EXISTS device_name_snapshot TEXT;

CREATE INDEX IF NOT EXISTS idx_inference_requests_started_status ON inference_requests(started_at DESC, status);
