const { Pool } = require('pg');
require('dotenv').config();

const hasDatabaseUrl = Boolean(
  process.env.DATABASE_URL &&
    process.env.DATABASE_URL.trim() &&
    !process.env.DATABASE_URL.includes('username:password@host'),
);
const useFileStore = process.env.USE_FILE_STORE === 'true' || process.env.NODE_ENV === 'test';

const pool = !useFileStore && hasDatabaseUrl
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    })
  : null;

const DEFAULT_CATEGORIES = [
  'Pothole',
  'Water Leak',
  'Burst Pipe',
  'Broken Streetlight',
  'Damaged Road',
  'Illegal Dumping',
  'Blocked Drain',
  'Sewer Problem',
  'Traffic Signal Problem',
  'Electrical Infrastructure',
  'Other Municipal Issue',
];

async function initDatabase() {
  if (!pool) {
    return false;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS issue_categories (
      id SERIAL PRIMARY KEY,
      slug VARCHAR(120) UNIQUE NOT NULL,
      name VARCHAR(120) NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
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
  `);

  await pool.query(`ALTER TABLE issues ADD COLUMN IF NOT EXISTS operations JSONB NOT NULL DEFAULT '{}'::jsonb;`);

  for (const name of DEFAULT_CATEGORIES) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    await pool.query(
      `
        INSERT INTO issue_categories (slug, name)
        VALUES ($1, $2)
        ON CONFLICT (slug) DO NOTHING;
      `,
      [slug, name],
    );
  }

  return true;
}

async function getCategoriesFromDb() {
  if (!pool) {
    return [];
  }

  const result = await pool.query(
    `SELECT id, slug, name, description FROM issue_categories ORDER BY name ASC;`,
  );

  return result.rows;
}

function normalizeReportRow(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category_name || row.category || 'Other Municipal Issue',
    description: row.description,
    location: {
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      city: row.city || '',
      municipality: row.municipality || '',
      address: row.address || '',
    },
    priority: row.priority || 'Medium',
    status: row.status || 'Reported',
    reportedBy: row.reported_by || 'Resident',
    reportedAt: row.reported_at || row.created_at,
    image: row.evidence_image || undefined,
    ...(row.operations && typeof row.operations === 'object' ? row.operations : {}),
  };
}

async function getReportsFromDb(query = {}) {
  if (!pool) {
    return [];
  }

  const { category, status, search } = query;
  let sql = `
    SELECT i.*, c.name AS category, c.slug AS category_slug
    FROM issues i
    LEFT JOIN issue_categories c ON c.id = i.category_id
    WHERE 1 = 1
  `;
  const params = [];
  let i = 1;

  if (category) {
    sql += ` AND LOWER(COALESCE(c.name, i.category_name, '')) = $${i}`;
    params.push(String(category).trim().toLowerCase());
    i += 1;
  }

  if (status) {
    sql += ` AND LOWER(i.status) = $${i}`;
    params.push(String(status).trim().toLowerCase());
    i += 1;
  }

  if (search) {
    sql += ` AND (
      LOWER(i.title) LIKE $${i}
      OR LOWER(i.description) LIKE $${i}
      OR LOWER(i.city) LIKE $${i}
      OR LOWER(i.municipality) LIKE $${i}
      OR LOWER(COALESCE(c.name, i.category_name, '')) LIKE $${i}
    )`;
    const term = `%${String(search).trim().toLowerCase()}%`;
    params.push(term, term, term, term, term);
    i += 5;
  }

  sql += ' ORDER BY i.reported_at DESC';

  const result = await pool.query(sql, params);
  return result.rows.map(normalizeReportRow);
}

async function createReportInDb(payload) {
  if (!pool) {
    return null;
  }

  const categoryName = payload.category || 'Other Municipal Issue';
  const categorySlug = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const categoryResult = await pool.query(
    `SELECT id, name FROM issue_categories WHERE slug = $1 LIMIT 1;`,
    [categorySlug],
  );

  const categoryRecord = categoryResult.rows[0];
  const categoryId = categoryRecord ? categoryRecord.id : null;

  const result = await pool.query(
    `
      INSERT INTO issues (
        title,
        description,
        city,
        municipality,
        latitude,
        longitude,
        status,
        priority,
        reported_by,
        evidence_image,
        category_id,
        category_name,
        reported_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      RETURNING *;
    `,
    [
      payload.title,
      payload.description,
      payload.location?.city || '',
      payload.location?.municipality || '',
      Number(payload.location.latitude),
      Number(payload.location.longitude),
      payload.status || 'Reported',
      payload.priority || 'Medium',
      payload.reportedBy || 'Resident',
      payload.image || null,
      categoryId,
      categoryName,
    ],
  );

  const row = result.rows[0];
  return normalizeReportRow(row);
}

async function updateReportStatusInDb(reportId, newStatus) {
  if (!pool) {
    return null;
  }

  const result = await pool.query(
    `
      UPDATE issues
        SET status = $1,
          operations = jsonb_set(operations, '{status}', to_jsonb($1::text), true),
          updated_at = NOW()
      WHERE id = $2
      RETURNING *;
    `,
    [newStatus, reportId],
  );

  if (!result.rows[0]) {
    return null;
  }

  return normalizeReportRow(result.rows[0]);
}

async function updateReportOperationsInDb(reportId, operations) {
  if (!pool) {
    return null;
  }

  const result = await pool.query(
    `
      UPDATE issues
      SET status = $1,
          priority = $2,
          category_name = $3,
          category_id = (SELECT id FROM issue_categories WHERE slug = $4 LIMIT 1),
          operations = $5::jsonb,
          updated_at = NOW()
      WHERE id = $6
      RETURNING *;
    `,
    [
      operations.status || 'Reported',
      operations.priority || 'Medium',
      operations.category || 'Other Municipal Issue',
      String(operations.category || 'Other Municipal Issue').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      JSON.stringify(operations),
      reportId,
    ],
  );

  return result.rows[0] ? normalizeReportRow(result.rows[0]) : null;
}

async function deleteAllReportsInDb() {
  if (!pool) {
    return 0;
  }

  const result = await pool.query('DELETE FROM issues;');
  return Number(result.rowCount || 0);
}

async function deleteReportInDb(reportId) {
  if (!pool) {
    return false;
  }

  const result = await pool.query('DELETE FROM issues WHERE id = $1;', [reportId]);
  return Number(result.rowCount || 0) > 0;
}

module.exports = {
  pool,
  initDatabase,
  getCategoriesFromDb,
  getReportsFromDb,
  createReportInDb,
  updateReportStatusInDb,
  updateReportOperationsInDb,
  deleteReportInDb,
  deleteAllReportsInDb,
  DEFAULT_CATEGORIES,
};
