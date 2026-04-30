-- Admin-managed redirects. One row = one rule.
-- Lookup is exact-match on (source_host, source_path); pattern matching is
-- intentionally out of scope for v1 — keep the table simple.
--
-- source_host: bare hostname, lowercase, no scheme/port (e.g. "lens.pt").
-- source_path: leading slash, no trailing slash unless it's "/" itself.
-- target_url:  absolute URL (https://...) or absolute path on the same host
--              (e.g. "/photographers/lisbon"). Query string from the request
--              is appended ONLY when the target has none of its own.
-- status_code: 301/302/307/308. Default 301.

CREATE TABLE IF NOT EXISTS redirects (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_host  TEXT NOT NULL,
  source_path  TEXT NOT NULL,
  target_url   TEXT NOT NULL,
  status_code  SMALLINT NOT NULL DEFAULT 301
                 CHECK (status_code IN (301, 302, 307, 308)),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_host, source_path)
);

CREATE INDEX IF NOT EXISTS idx_redirects_host_path
  ON redirects (source_host, source_path);
