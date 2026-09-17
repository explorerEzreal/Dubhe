-- 分组与渠道概念
-- 引入分组（Group）、分组成员（group_agents）、用户渠道（user_group_access）
-- API Key 从模型级权限改为渠道级权限，废弃 api_key_model_permissions

CREATE TABLE IF NOT EXISTS groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_groups_user ON groups(user_id);

CREATE TABLE IF NOT EXISTS group_agents (
  group_id  UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  agent_id  UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_group_agents_agent ON group_agents(agent_id);

CREATE TABLE IF NOT EXISTS user_group_access (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id   UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  source     TEXT NOT NULL DEFAULT 'invited',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_user_group_access_user ON user_group_access(user_id);

-- api_keys 加 group_id 列
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL;

-- 废弃旧的模型级权限表（不再使用）
-- DROP TABLE IF EXISTS api_key_model_permissions;
-- 暂时保留该表，方便回滚；代码中不再读取和写入
