CREATE TABLE IF NOT EXISTS municipalities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  province TEXT NOT NULL DEFAULT '',
  municipality_code TEXT NOT NULL UNIQUE,
  municipality_type TEXT NOT NULL DEFAULT '',
  boundary_data JSONB,
  boundary_source TEXT NOT NULL,
  boundary_dataset TEXT NOT NULL,
  access_code_hash TEXT,
  access_code_version INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE staff_users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'staff',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS municipality_id TEXT REFERENCES municipalities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS issues_municipality_id_idx ON issues (municipality_id);

CREATE TABLE IF NOT EXISTS staff_municipalities (
  staff_id TEXT NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  municipality_id TEXT NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (staff_id, municipality_id)
);

CREATE INDEX IF NOT EXISTS staff_municipalities_municipality_idx
  ON staff_municipalities (municipality_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES staff_users(id) ON DELETE RESTRICT,
  municipality_id TEXT REFERENCES municipalities(id) ON DELETE SET NULL,
  report_id UUID REFERENCES issues(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_municipality_created_idx
  ON audit_logs (municipality_id, created_at DESC);