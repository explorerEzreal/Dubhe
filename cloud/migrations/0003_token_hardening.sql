ALTER TABLE enrollment_tokens ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE enrollment_tokens ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollment_tokens_token_hash ON enrollment_tokens(token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_credentials_cred_hash ON agent_credentials(cred_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_last_used ON sessions(last_used_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrollment_tokens_active ON enrollment_tokens(token_hash, expires_at) WHERE used = FALSE AND revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_agent_credentials_replaced_by ON agent_credentials(replaced_by) WHERE replaced_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_created ON audit_logs(resource, created_at DESC);
