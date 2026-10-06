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
    const appliedMigrations = await client.query('SELECT version FROM schema_migrations;');
    const appliedVersions = new Set(appliedMigrations.rows.map((row) => row.version));
    const municipalityMigration = '002_municipality_scoping.sql';
    if (migrationFiles.includes(municipalityMigration) && !appliedVersions.has(municipalityMigration) &&
        process.env.ENABLE_MUNICIPALITY_SCOPING_MIGRATION !== 'true') {
      throw new Error('Municipality migration 002 is pending. Verify it on a disposable PostgreSQL database and explicitly enable it before applying.');
    }

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
    `SELECT id, name, email, password_hash AS password, role, is_active AS "isActive", created_at AS "createdAt"
     FROM staff_users WHERE LOWER(email) = LOWER($1) LIMIT 1;`,
    [email],
  );
  return result.rows[0] || null;
}

async function getStaffByIdFromDb(staffId, queryPool = pool) {
  if (!queryPool) return null;
  const result = await queryPool.query(
    `SELECT id, name, email, role, is_active AS "isActive" FROM staff_users WHERE id = $1 LIMIT 1;`,
    [staffId],
  );
  return result.rows[0] || null;
}

async function createStaffInDb(staff) {
  if (!pool) return null;
  const result = await pool.query(
    `INSERT INTO staff_users (id, name, email, password_hash, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, email, password_hash AS password, role, created_at AS "createdAt";`,
    [staff.id, staff.name, staff.email, staff.password, staff.role || 'staff'],
  );
  return result.rows[0];
}

async function getStaffDirectoryFromDb() {
  if (!pool) return [];
  const result = await pool.query('SELECT id, name, email, role, is_active AS "isActive" FROM staff_users ORDER BY name ASC;');
  return result.rows;
}

async function getStaffById(staffId) {
  if (!pool) return null;
  const result = await pool.query(
    `SELECT id, name, email, role, is_active AS "isActive" FROM staff_users WHERE id = $1 LIMIT 1;`,
    [staffId],
  );
  return result.rows[0] || null;
}

async function countSuperAdmins() {
  if (!pool) return 0;
  const result = await pool.query("SELECT COUNT(*)::INTEGER AS count FROM staff_users WHERE role = 'super_admin';");
  return Number(result.rows[0]?.count || 0);
}

async function upsertMunicipality(municipality) {
  if (!pool) return null;
  const result = await pool.query(
    `INSERT INTO municipalities
       (id, name, province, municipality_code, municipality_type, boundary_source, boundary_dataset)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (municipality_code) DO UPDATE SET
       name = EXCLUDED.name,
       province = EXCLUDED.province,
       municipality_type = EXCLUDED.municipality_type,
       boundary_source = EXCLUDED.boundary_source,
       boundary_dataset = EXCLUDED.boundary_dataset,
       updated_at = NOW()
     RETURNING id, name, province, municipality_code AS code,
       municipality_type AS type, boundary_source AS "boundarySource",
       boundary_dataset AS "boundaryDataset", access_code_hash AS "accessCodeHash",
       access_code_version AS "accessCodeVersion", active;`,
    [municipality.code, municipality.name, municipality.province, municipality.code,
      municipality.type, municipality.boundarySource, municipality.boundaryDataset],
  );
  return result.rows[0] || null;
}

async function getMunicipalityById(municipalityId) {
  if (!pool) return null;
  const result = await pool.query(
    `SELECT id, name, province, municipality_code AS code,
       municipality_type AS type, boundary_source AS "boundarySource",
       boundary_dataset AS "boundaryDataset", access_code_hash AS "accessCodeHash",
       access_code_version AS "accessCodeVersion", active
     FROM municipalities WHERE id = $1 LIMIT 1;`,
    [municipalityId],
  );
  return result.rows[0] || null;
}

async function listMunicipalities() {
  if (!pool) return [];
  const result = await pool.query(
    `SELECT m.id, m.name, m.province, m.municipality_code AS code,
       m.municipality_type AS type, m.boundary_source AS "boundarySource",
       m.boundary_dataset AS "boundaryDataset", m.active,
       COUNT(DISTINCT i.id)::INTEGER AS "reportCount",
       COUNT(DISTINCT sm.staff_id)::INTEGER AS "staffCount"
     FROM municipalities m
     LEFT JOIN issues i ON i.municipality_id = m.id
     LEFT JOIN staff_municipalities sm ON sm.municipality_id = m.id
     GROUP BY m.id
     ORDER BY m.province, m.name;`,
  );
  return result.rows;
}

async function getStaffMunicipalities(staffId) {
  if (!pool) return [];
  const result = await pool.query(
    `SELECT m.id, m.name, m.province, m.municipality_code AS code,
       m.municipality_type AS type
     FROM staff_municipalities sm
     JOIN municipalities m ON m.id = sm.municipality_id
     WHERE sm.staff_id = $1 AND m.active = TRUE
     ORDER BY m.name;`,
    [staffId],
  );
  return result.rows;
}

async function staffHasMunicipality(staffId, municipalityId) {
  if (!pool) return false;
  const result = await pool.query(
    `SELECT 1 FROM staff_municipalities sm
     JOIN municipalities m ON m.id = sm.municipality_id
     WHERE sm.staff_id = $1 AND sm.municipality_id = $2 AND m.active = TRUE LIMIT 1;`,
    [staffId, municipalityId],
  );
  return result.rowCount > 0;
}

async function assignStaffMunicipality(staffId, municipalityId) {
  if (!pool) return false;
  const result = await pool.query(
    `INSERT INTO staff_municipalities (staff_id, municipality_id)
     SELECT $1, $2
     WHERE EXISTS (SELECT 1 FROM staff_users WHERE id = $1 AND role = 'staff')
       AND EXISTS (SELECT 1 FROM municipalities WHERE id = $2 AND active = TRUE)
     ON CONFLICT (staff_id, municipality_id) DO NOTHING
     RETURNING staff_id;`,
    [staffId, municipalityId],
  );
  return result.rowCount > 0;
}

async function removeStaffMunicipality(staffId, municipalityId) {
  if (!pool) return false;
  const result = await pool.query(
    'DELETE FROM staff_municipalities WHERE staff_id = $1 AND municipality_id = $2;',
    [staffId, municipalityId],
  );
  return result.rowCount > 0;
}

async function setStaffActive(staffId, active) {
  if (!pool) return null;
  const result = await pool.query(
    `UPDATE staff_users SET is_active = $2
     WHERE id = $1 AND role = 'staff'
     RETURNING id, is_active AS "isActive";`,
    [staffId, active],
  );
  return result.rows[0] || null;
}

async function setMunicipalityActive(municipalityId, active) {
  if (!pool) return null;
  const result = await pool.query(
    `UPDATE municipalities SET active = $2, access_code_version = access_code_version + 1,
       updated_at = NOW()
     WHERE id = $1
     RETURNING id, active, access_code_version AS "accessCodeVersion";`,
    [municipalityId, active],
  );
  return result.rows[0] || null;
}

async function setMunicipalityAccessCode(municipalityId, accessCodeHash) {
  if (!pool) return null;
  const result = await pool.query(
    `UPDATE municipalities SET access_code_hash = $2,
       access_code_version = access_code_version + 1, updated_at = NOW()
     WHERE id = $1
     RETURNING id, access_code_version AS "accessCodeVersion";`,
    [municipalityId, accessCodeHash],
  );
  return result.rows[0] || null;
}

async function createAuditLog({ userId, municipalityId, reportId, action, details = {} }) {
  if (!pool) return null;
  const result = await pool.query(
    `INSERT INTO audit_logs (user_id, municipality_id, report_id, action, details)
     VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id, created_at AS "createdAt";`,
    [userId, municipalityId || null, reportId || null, action, JSON.stringify(details)],
  );
  return result.rows[0] || null;
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
      municipality: row.municipality_name || row.municipality || '',
      address: row.address || '',
    },
    municipalityId: row.municipality_id || undefined,
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

  const { category, status, search, residentId, municipalityId } = query;
  let sql = `
    SELECT i.*, c.name AS category, c.slug AS category_slug, m.name AS municipality_name
    FROM issues i
    LEFT JOIN issue_categories c ON c.id = i.category_id
    LEFT JOIN municipalities m ON m.id = i.municipality_id
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

  if (municipalityId) {
    sql += ` AND i.municipality_id = $${i}`;
    params.push(String(municipalityId));
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
        municipality_id,
        address,
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
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
      RETURNING *;
    `,
    [
      payload.title,
      payload.description,
      payload.location?.city || '',
      payload.location?.municipality || '',
      payload.location?.municipalityId || null,
      payload.location?.address || '',
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

async function updateReportStatusInDb(reportId, newStatus, authorizationScope) {
  if (!pool) {
    return null;
  }

  const scopeSql = authorizationScope
    ? `AND municipality_id = $3
       AND EXISTS (
         SELECT 1 FROM staff_municipalities sm
         JOIN municipalities m ON m.id = sm.municipality_id
         JOIN staff_users su ON su.id = sm.staff_id
         WHERE sm.staff_id = $4 AND sm.municipality_id = $3
           AND m.active = TRUE AND m.access_code_hash IS NOT NULL
           AND m.access_code_version = $5 AND su.is_active = TRUE
       )`
    : '';
  const params = authorizationScope
    ? [newStatus, reportId, authorizationScope.municipalityId, authorizationScope.staffId, authorizationScope.accessCodeVersion]
    : [newStatus, reportId];
  const result = await pool.query(
    `
      UPDATE issues
        SET status = $1,
          operations = jsonb_set(operations, '{status}', to_jsonb($1::text), true),
          updated_at = NOW()
      WHERE id = $2 ${scopeSql}
      RETURNING *;
    `,
    params,
  );

  if (!result.rows[0]) {
    return null;
  }

  return normalizeReportRow(result.rows[0]);
}

async function updateReportOperationsInDb(reportId, operations, authorizationScope) {
  if (!pool) {
    return null;
  }

  const scopeSql = authorizationScope
    ? `AND municipality_id = $7
       AND EXISTS (
         SELECT 1 FROM staff_municipalities sm
         JOIN municipalities m ON m.id = sm.municipality_id
         JOIN staff_users su ON su.id = sm.staff_id
         WHERE sm.staff_id = $8 AND sm.municipality_id = $7
           AND m.active = TRUE AND m.access_code_hash IS NOT NULL
           AND m.access_code_version = $9 AND su.is_active = TRUE
       )`
    : '';
  const params = [
    operations.status || 'Reported',
    operations.priority || 'Medium',
    operations.category || 'Other Municipal Issue',
    String(operations.category || 'Other Municipal Issue').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    JSON.stringify(operations),
    reportId,
  ];
  if (authorizationScope) {
    params.push(authorizationScope.municipalityId, authorizationScope.staffId, authorizationScope.accessCodeVersion);
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
      WHERE id = $6 ${scopeSql}
      RETURNING *;
    `,
    params,
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
  getStaffById,
  createStaffInDb,
  getStaffDirectoryFromDb,
  countSuperAdmins,
  upsertMunicipality,
  getMunicipalityById,
  listMunicipalities,
  getStaffMunicipalities,
  staffHasMunicipality,
  assignStaffMunicipality,
  removeStaffMunicipality,
  setStaffActive,
  setMunicipalityActive,
  setMunicipalityAccessCode,
  createAuditLog,
  getCategoriesFromDb,
  getReportsFromDb,
  createReportInDb,
  updateReportStatusInDb,
  updateReportOperationsInDb,
  deleteReportInDb,
  deleteAllReportsInDb,
  DEFAULT_CATEGORIES,
};
