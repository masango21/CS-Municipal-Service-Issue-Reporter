const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const hasDatabaseUrl = Boolean(
  process.env.DATABASE_URL &&
    process.env.DATABASE_URL.trim() &&
    !process.env.DATABASE_URL.includes('username:password@host'),
);
const useFileStore = process.env.USE_FILE_STORE === 'true' || process.env.NODE_ENV === 'test';
const databaseUrl = hasDatabaseUrl ? new URL(process.env.DATABASE_URL) : null;

if (databaseUrl) {
  databaseUrl.searchParams.delete('sslmode');
  databaseUrl.searchParams.delete('channel_binding');
}

const pool = !useFileStore && hasDatabaseUrl
  ? new Pool({
      connectionString: databaseUrl.toString(),
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: true },
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
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(19791104);');
    const migrationDirectory = path.join(__dirname, 'sql', 'migrations');
    const migrationFiles = fs.readdirSync(migrationDirectory)
      .filter((file) => /^\d+_[a-z0-9_-]+\.sql$/i.test(file))
      .sort();

    for (const version of migrationFiles) {
      const existing = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1;', [version]);
      if (existing.rowCount) continue;

      await client.query('BEGIN;');
      try {
        const migration = fs.readFileSync(path.join(migrationDirectory, version), 'utf8');
        await client.query(migration);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1);', [version]);
        await client.query('COMMIT;');
      } catch (error) {
        await client.query('ROLLBACK;');
        throw error;
      }
    }
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock(19791104);');
    } finally {
      client.release();
    }
  }

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

async function getReportCountFromDb() {
  if (!pool) return 0;
  const result = await pool.query('SELECT COUNT(*)::INTEGER AS count FROM issues;');
  return result.rows[0].count;
}

async function getResidentByEmail(email) {
  if (!pool) return null;
  const result = await pool.query(
    `SELECT id, name, email, password_hash AS password, phone, created_at AS "createdAt"
     FROM resident_users WHERE LOWER(email) = LOWER($1) LIMIT 1;`,
    [email],
  );
  return result.rows[0] || null;
}

async function createResidentInDb(user) {
  if (!pool) return null;
  const result = await pool.query(
    `INSERT INTO resident_users (id, name, email, password_hash, phone)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, email, password_hash AS password, phone, created_at AS "createdAt";`,
    [user.id, user.name, user.email, user.password, user.phone || null],
  );
  return result.rows[0];
}

async function getStaffByEmail(email) {
  if (!pool) return null;
  const result = await pool.query(
    `SELECT id, name, email, password_hash AS password, created_at AS "createdAt"
     FROM staff_users WHERE LOWER(email) = LOWER($1) LIMIT 1;`,
    [email],
  );
  return result.rows[0] || null;
}

async function getStaffByIdFromDb(staffId, queryPool = pool) {
  if (!queryPool) return null;
  const result = await queryPool.query(
    `SELECT id, name, email FROM staff_users WHERE id = $1 LIMIT 1;`,
    [staffId],
  );
  return result.rows[0] || null;
}

async function createStaffInDb(staff) {
  if (!pool) return null;
  const result = await pool.query(
    `INSERT INTO staff_users (id, name, email, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, password_hash AS password, created_at AS "createdAt";`,
    [staff.id, staff.name, staff.email, staff.password],
  );
  return result.rows[0];
}

async function getStaffDirectoryFromDb() {
  if (!pool) return [];
  const result = await pool.query('SELECT id, name, email FROM staff_users ORDER BY name ASC;');
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
    residentId: row.resident_id || undefined,
    reportedAt: row.reported_at || row.created_at,
    image: row.evidence_image || undefined,
    ...(row.operations && typeof row.operations === 'object' ? row.operations : {}),
  };
}

async function getReportsFromDb(query = {}) {
  if (!pool) {
    return [];
  }

  const { category, status, search, residentId } = query;
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

  if (residentId) {
    sql += ` AND i.resident_id = $${i}`;
    params.push(String(residentId));
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
        resident_id,
        reported_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
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
      payload.residentId || null,
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
  getReportCountFromDb,
  getResidentByEmail,
  createResidentInDb,
  getStaffByEmail,
  getStaffByIdFromDb,
  createStaffInDb,
  getStaffDirectoryFromDb,
  getCategoriesFromDb,
  getReportsFromDb,
  createReportInDb,
  updateReportStatusInDb,
  updateReportOperationsInDb,
  deleteReportInDb,
  deleteAllReportsInDb,
  DEFAULT_CATEGORIES,
};
