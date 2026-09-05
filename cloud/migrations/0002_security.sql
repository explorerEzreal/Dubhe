ALTER TABLE sessions ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
ALTER TABLE agent_credentials ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE agent_credentials ADD COLUMN IF NOT EXISTS replaced_by UUID REFERENCES agent_credentials(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_token_active ON sessions(token_hash, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON sessions(user_id, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_agent_credentials_active ON agent_credentials(agent_id, cred_hash) WHERE revoked = FALSE AND revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created ON audit_logs(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created ON audit_logs(action, created_at DESC);
