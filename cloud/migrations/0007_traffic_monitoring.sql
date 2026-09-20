-- 流量监控事实字段：保存请求发生时的分组归属和总 Token。
ALTER TABLE inference_requests ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL;
ALTER TABLE inference_requests ADD COLUMN IF NOT EXISTS total_tokens INTEGER;

UPDATE inference_requests
   SET total_tokens = COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)
 WHERE total_tokens IS NULL AND (input_tokens IS NOT NULL OR output_tokens IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_inference_requests_group_started ON inference_requests(group_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_inference_requests_user_started ON inference_requests(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_inference_requests_key_started ON inference_requests(api_key_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_inference_requests_agent_started ON inference_requests(agent_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_inference_requests_status_started ON inference_requests(status, started_at DESC);
