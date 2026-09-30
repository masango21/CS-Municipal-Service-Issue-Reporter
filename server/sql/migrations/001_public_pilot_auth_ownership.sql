CREATE TABLE IF NOT EXISTS resident_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS resident_users_email_lower_idx
  ON resident_users (LOWER(email));

CREATE TABLE IF NOT EXISTS staff_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS staff_users_email_lower_idx
  ON staff_users (LOWER(email));

CREATE TABLE IF NOT EXISTS issue_categories (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(120) UNIQUE NOT NULL,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  city TEXT,
  municipality TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Reported',
  priority VARCHAR(30) NOT NULL DEFAULT 'Medium',
  reported_by TEXT NOT NULL DEFAULT 'Resident',
  evidence_image TEXT,
  category_id INTEGER REFERENCES issue_categories(id),
  category_name TEXT,
  resident_id TEXT REFERENCES resident_users(id) ON DELETE SET NULL,
  operations JSONB NOT NULL DEFAULT '{}'::jsonb,
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE issues ADD COLUMN IF NOT EXISTS resident_id TEXT REFERENCES resident_users(id) ON DELETE SET NULL;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS operations JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS issues_resident_id_idx ON issues (resident_id);
