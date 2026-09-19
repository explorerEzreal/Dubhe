-- 设备状态和名称兼容历史数据，资源快照继续复用 agents.hardware_info。
UPDATE agents
SET name = device_id, updated_at = now()
WHERE name IS NULL OR btrim(name) = '';

UPDATE agents
SET status = 'offline', updated_at = now()
WHERE status IS NULL
   OR status NOT IN ('created', 'connecting', 'online', 'degraded', 'offline', 'revoked');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agents_status_allowed'
  ) THEN
    ALTER TABLE agents
      ADD CONSTRAINT agents_status_allowed
      CHECK (status IN ('created', 'connecting', 'online', 'degraded', 'offline', 'revoked'));
  END IF;
END $$;
