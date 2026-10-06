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
  operations JSONB NOT NULL DEFAULT '{}'::jsonb,
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO issue_categories (slug, name)
VALUES
  ('pothole', 'Pothole'),
  ('water-leak', 'Water Leak'),
  ('burst-pipe', 'Burst Pipe'),
  ('broken-streetlight', 'Broken Streetlight'),
  ('damaged-road', 'Damaged Road'),
  ('illegal-dumping', 'Illegal Dumping'),
  ('blocked-drain', 'Blocked Drain'),
  ('sewer-problem', 'Sewer Problem'),
  ('traffic-signal-problem', 'Traffic Signal Problem'),
  ('electrical-infrastructure', 'Electrical Infrastructure'),
  ('other-municipal-issue', 'Other Municipal Issue')
ON CONFLICT (slug) DO NOTHING;
