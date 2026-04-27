-- AI selfie generation feature: tracks each gpt-image-2 call so we can rate-limit
-- and capture leads (email gate after first free generation).
-- Used by /try-yourself + /api/ai-generate.

CREATE TABLE IF NOT EXISTS ai_generations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id VARCHAR(64) NOT NULL,             -- httpOnly cookie, opaque random
  ip INET,                                     -- secondary throttle key
  email VARCHAR(255),                          -- captured after first free gen
  scene_id VARCHAR(50) NOT NULL,
  reference_image_key TEXT,                    -- R2 key of uploaded selfie (s3 path)
  result_image_key TEXT,                       -- R2 key of generated image
  cost_cents INTEGER,                          -- estimate, for ops cost tracking
  user_agent TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | success | failed
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_gens_session_recent ON ai_generations(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_gens_ip_recent ON ai_generations(ip, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_gens_email ON ai_generations(email) WHERE email IS NOT NULL;
