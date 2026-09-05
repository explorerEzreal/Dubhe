CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enrollment_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id      TEXT NOT NULL UNIQUE,
  name           TEXT,
  status         TEXT NOT NULL DEFAULT 'created',
  hardware_info  JSONB,
  last_seen_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_credentials (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id   UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  cred_hash  TEXT NOT NULL,
  revoked    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS models (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  engine      TEXT NOT NULL DEFAULT 'ollama',
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_models_name ON models(name);

CREATE TABLE IF NOT EXISTS model_instances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  model_id        UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  state           TEXT NOT NULL DEFAULT 'unknown',
  max_concurrency INTEGER NOT NULL DEFAULT 1,
  last_error      TEXT,
  last_ready_at   TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_model_instances_agent_model ON model_instances(agent_id, model_id);

CREATE TABLE IF NOT EXISTS api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prefix        TEXT NOT NULL UNIQUE,
  key_hash      TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active',
  expires_at    TIMESTAMPTZ,
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_key_model_permissions (
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  model_id   UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  PRIMARY KEY (api_key_id, model_id)
);

CREATE TABLE IF NOT EXISTS inference_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   TEXT NOT NULL UNIQUE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  api_key_id   UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  agent_id     UUID REFERENCES agents(id) ON DELETE SET NULL,
  model_id     UUID REFERENCES models(id) ON DELETE SET NULL,
  status       TEXT NOT NULL DEFAULT 'accepted',
  status_code  INTEGER,
  input_tokens  INTEGER,
  output_tokens INTEGER,
  latency_ms   INTEGER,
  error_code   TEXT,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id   UUID,
  action     TEXT NOT NULL,
  resource   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agents_user ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_model_instances_state ON model_instances(state);
CREATE INDEX IF NOT EXISTS idx_inference_requests_started ON inference_requests(started_at);
