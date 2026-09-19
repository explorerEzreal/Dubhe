-- 添加设备时预创建设备，Agent 注册后再绑定物理设备标识。
ALTER TABLE agents ALTER COLUMN device_id DROP NOT NULL;

UPDATE agents
SET name = coalesce(nullif(btrim(name), ''), device_id, id::text)
WHERE name IS NULL OR btrim(name) = '';

ALTER TABLE agents ALTER COLUMN name SET NOT NULL;

ALTER TABLE enrollment_tokens
  ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_enrollment_tokens_agent
  ON enrollment_tokens(agent_id);
