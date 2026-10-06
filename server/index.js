require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '.env.staff-invites') });
const {
  initDatabase,
  getReportCountFromDb,
  getCategoriesFromDb,
  getReportsFromDb,
  createReportInDb,
  updateReportStatusInDb,
  updateReportOperationsInDb,
  deleteReportInDb,
  deleteAllReportsInDb,
  getResidentByEmail,
  createResidentInDb,
  getStaffByEmail,
  getStaffById,
  getStaffByIdFromDb,
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
  DEFAULT_CATEGORIES,
  pool,
} = require('./db');
const { listOfficialMunicipalities, resolveLocation } = require('./location');

const app = express();
const PORT = process.env.PORT || 4000;
const SESSION_COOKIE = 'msr_session';
const configuredClientOrigins = (process.env.CLIENT_ORIGIN || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000'))
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);
const CLIENT_ORIGINS = process.env.NODE_ENV === 'production'
  ? configuredClientOrigins
  : [...new Set([...configuredClientOrigins, 'http://localhost:3000', 'http://127.0.0.1:3000'])];
const SESSION_MAX_AGE_MS = 60 * 60 * 1000;
const STORE_PATH = process.env.DATA_STORE_PATH || path.join(__dirname, 'data', 'store.json');
const DATA_DIR = path.dirname(STORE_PATH);

const VALID_STATUSES = [
  'Reported',
  'Under Review',
  'Assigned',
  'In Progress',
  'Resolved',
  'Closed',
];
const VALID_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

const DEFAULT_STORE = {
  reports: [],
  users: [],
  admins: [],
  municipalities: [],
  staffMunicipalities: [],
  auditLogs: [],
};

function ensureDataStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify(DEFAULT_STORE, null, 2));
  }
}

function readStore() {
  ensureDataStore();

  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);

    return {
      reports: Array.isArray(parsed.reports) ? parsed.reports : [],
      users: Array.isArray(parsed.users) ? parsed.users : [],
      admins: Array.isArray(parsed.admins) ? parsed.admins : [],
      municipalities: Array.isArray(parsed.municipalities) ? parsed.municipalities : [],
      staffMunicipalities: Array.isArray(parsed.staffMunicipalities) ? parsed.staffMunicipalities : [],
      auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
    };
  } catch (error) {
    console.error('Unable to read store, resetting to empty state.', error);
    fs.writeFileSync(STORE_PATH, JSON.stringify(DEFAULT_STORE, null, 2));
    return { ...DEFAULT_STORE };
  }
}

function writeStore(store) {
  ensureDataStore();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, storedPassword) {
  if (String(storedPassword).startsWith('scrypt:')) {
    const [, salt, expectedHash] = storedPassword.split(':');
    const actualHash = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHash, 'hex');
    return expected.length === actualHash.length && crypto.timingSafeEqual(actualHash, expected);
  }
  return password === storedPassword;
}

function createToken(payload) {
  const secret = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'test-only-secret' : null);
  if (!secret) {
    throw new Error('JWT_SECRET must be configured before issuing tokens');
  }
  return jwt.sign(payload, secret, { expiresIn: '1h' });
}

function requestToken(req) {
  return req.cookies?.[SESSION_COOKIE] || String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
}

function verifyRequestToken(req) {
  const token = requestToken(req);
  const secret = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'test-only-secret' : null);

  if (!token || !secret) return null;

  try {
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

function requireRole(role) {
  return async (req, res, next) => {
    const claims = verifyRequestToken(req);
    if (!claims?.id) return res.status(401).json({ message: 'Authentication is required' });

    try {
      let account;
      let actualRole;
      if (claims.role === 'resident') {
        account = pool
          ? await getResidentByEmail(claims.email)
          : readStore().users.find((user) => user.id === claims.id);
        actualRole = 'resident';
      } else if (['admin', 'staff', 'super_admin'].includes(claims.role)) {
        account = pool
          ? await getStaffById(claims.id)
          : readStore().admins.find((admin) => admin.id === claims.id);
        actualRole = account?.role === 'super_admin' ? 'super_admin' : 'staff';
      }

      if (!account || account.id !== claims.id) {
        return res.status(401).json({ message: 'Authentication is required' });
      }
      if (account.isActive === false || account.active === false) {
        clearSessionCookie(res);
        return res.status(401).json({ message: 'This account is inactive.' });
      }
      if (role === 'resident' && actualRole !== 'resident') {
        return res.status(403).json({ message: 'Access is not permitted' });
      }
      if (role === 'staff' && !['staff', 'super_admin'].includes(actualRole)) {
        return res.status(403).json({ message: 'Access is not permitted' });
      }
      if (role === 'super_admin' && actualRole !== 'super_admin') {
        return res.status(403).json({ message: 'Access is not permitted' });
      }

      req.sessionClaims = claims;
      req.auth = { id: account.id, email: account.email, name: account.name, role: actualRole };
      if (actualRole !== 'resident') req.staff = req.auth;
    } catch (error) {
      console.error('Account authorization lookup failed:', error);
      return res.status(503).json({ message: 'Unable to verify account access right now' });
    }
    return next();
  };
}

const requireStaff = requireRole('staff');
const requireAdmin = requireStaff;
const requireSuperAdmin = requireRole('super_admin');
const requireResident = requireRole('resident');
const requireOperationalStaff = (req, res, next) => requireStaff(req, res, () => {
  if (req.auth.role !== 'staff') {
    return res.status(403).json({ message: 'Municipal staff access is required.' });
  }
  return next();
});

async function getMunicipalityRecord(municipalityId) {
  if (pool) return getMunicipalityById(municipalityId);
  return readStore().municipalities.find((municipality) => municipality.id === municipalityId) || null;
}

async function saveMunicipalityRecord(municipality) {
  if (pool) return upsertMunicipality(municipality);
  const store = readStore();
  let record = store.municipalities.find((entry) => entry.code === municipality.code);
  if (record) {
    Object.assign(record, {
      name: municipality.name,
      province: municipality.province,
      type: municipality.type,
      boundarySource: municipality.boundarySource,
      boundaryDataset: municipality.boundaryDataset,
      updatedAt: new Date().toISOString(),
    });
  } else {
    record = {
      ...municipality,
      id: municipality.code,
      active: true,
      accessCodeHash: null,
      accessCodeVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.municipalities.push(record);
  }
  writeStore(store);
  return record;
}

async function staffAssignedTo(staffId, municipalityId) {
  if (pool) return staffHasMunicipality(staffId, municipalityId);
  return readStore().staffMunicipalities.some((assignment) =>
    assignment.staffId === staffId && assignment.municipalityId === municipalityId,
  );
}

async function hasVerifiedMunicipalityAccess(req, municipalityId) {
  if (req.auth.role === 'super_admin') return true;
  const claims = req.sessionClaims || {};
  if (!municipalityId || claims.municipalityId !== municipalityId) return false;
  if (!await staffAssignedTo(req.auth.id, municipalityId)) return false;
  const municipality = await getMunicipalityRecord(municipalityId);
  return Boolean(municipality?.active && municipality.accessCodeHash &&
    Number(municipality.accessCodeVersion) === Number(claims.accessCodeVersion));
}

async function requireActiveMunicipality(req, res) {
  if (req.auth.role === 'super_admin') return null;
  const municipalityId = req.sessionClaims?.municipalityId;
  if (!await hasVerifiedMunicipalityAccess(req, municipalityId)) {
    res.status(403).json({ message: 'Municipality access is missing or expired. Verify access again.' });
    return undefined;
  }
  return municipalityId;
}

async function findAuthorizedReport(req, reportId, res) {
  const report = await findReport(reportId);
  if (!report) {
    res.status(404).json({ message: 'Report not found' });
    return null;
  }
  if (req.auth.role !== 'super_admin') {
    const municipalityId = report.municipalityId || report.location?.municipalityId;
    if (!await hasVerifiedMunicipalityAccess(req, municipalityId)) {
      res.status(403).json({ message: 'Access is not permitted for this report' });
      return null;
    }
  }
  return report;
}

function setSessionCookie(res, claims) {
  const token = createToken(claims);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.SESSION_COOKIE_SAME_SITE || 'lax',
    maxAge: SESSION_MAX_AGE_MS,
    path: '/',
  });
  return token;
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.SESSION_COOKIE_SAME_SITE || 'lax',
    path: '/',
  });
}

function validateIssuePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'Request body is required';
  }

  if (typeof payload.title !== 'string' || !payload.title.trim() || payload.title.length > 160) {
    return 'Title is required and must be 160 characters or fewer';
  }

  if (typeof payload.description !== 'string' || !payload.description.trim() || payload.description.length > 5000) {
    return 'Description is required and must be 5000 characters or fewer';
  }

  if (typeof payload.category !== 'string' || !DEFAULT_CATEGORIES.includes(payload.category)) {
    return 'Choose a valid municipal issue category';
  }

  if (!payload.location || typeof payload.location !== 'object') {
    return 'Location is required';
  }

  if (
    typeof payload.location.latitude !== 'number' ||
    typeof payload.location.longitude !== 'number' ||
    payload.location.latitude < -35.5 || payload.location.latitude > -22 ||
    payload.location.longitude < 16 || payload.location.longitude > 33
  ) {
    return 'Choose a valid location in South Africa';
  }

  if (payload.priority && !VALID_PRIORITIES.includes(payload.priority)) {
    return 'Choose a valid priority';
  }

  if (payload.image) {
    if (typeof payload.image !== 'string' || payload.image.length > 4_200_000) {
      return 'Evidence images must be 3 MB or smaller';
    }
    if (!/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/]+={0,2}$/i.test(payload.image)) {
      return 'Evidence must be a JPEG, PNG, or WebP image';
    }
  }

  return null;
}

async function findReport(reportId) {
  if (pool) {
    const reports = await getReportsFromDb();
    return reports.find((report) => report.id === reportId) || null;
  }
  return readStore().reports.find((report) => report.id === reportId) || null;
}

async function saveReportOperations(reportId, operations, req) {
  if (pool) {
    return updateReportOperationsInDb(reportId, operations, databaseAuthorizationScope(req));
  }
  const store = readStore();
  const report = store.reports.find((entry) => entry.id === reportId);
  if (!report) return null;
  Object.assign(report, operations);
  writeStore(store);
  return report;
}

function databaseAuthorizationScope(req) {
  if (req.auth.role !== 'staff') return undefined;
  return {
    staffId: req.auth.id,
    municipalityId: req.sessionClaims.municipalityId,
    accessCodeVersion: req.sessionClaims.accessCodeVersion,
  };
}

function publicReport(report) {
  if (!report) return report;
  const {
    staffNotes,
    verifiedBy,
    assignedStaffId,
    assignedStaffName,
    department,
    maintenanceTeam,
    residentId,
    reportedBy,
    residentUpdates,
    ...visibleReport
  } = report;
  if (Array.isArray(residentUpdates)) {
    visibleReport.residentUpdates = residentUpdates.map((update) => {
      if (!update || typeof update !== 'object') return update;
      const { authorId, ...visibleUpdate } = update;
      return visibleUpdate;
    });
  }
  return visibleReport;
}

function publicMunicipality(municipality) {
  if (!municipality) return municipality;
  const accessCodeConfigured = Boolean(municipality.accessCodeHash || municipality.access_code_hash);
  const { accessCodeHash, accessCodeVersion, access_code_hash, boundaryData, boundary_data, ...visible } = municipality;
  return { ...visible, accessCodeConfigured };
}

function staffReportSummary(report) {
  if (!report) return report;
  const { staffNotes, ...summary } = report;
  return summary;
}

function withDuplicateReferences(report, reports) {
  return {
    ...publicReport(report),
    duplicateReports: reports
      .filter((candidate) => candidate.duplicateOf === report.id)
      .map(({ id, title }) => ({ id, title })),
  };
}

app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);
app.use(helmet());
app.use(cookieParser());
app.use(cors({
  origin(origin, callback) {
    if (!origin || CLIENT_ORIGINS.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Protection'],
}));
app.use(express.json({ limit: '5mb' }));

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many authentication attempts. Please try again later.' },
});
const reportRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Report limit reached. Please try again later.' },
});
const locationRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Location lookups are temporarily limited. Please try again shortly.' },
});
const accessCodeRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many access-code attempts. Please try again later.' },
});
app.use([
  '/api/auth/register',
  '/api/auth/login',
  '/api/admin/register',
  '/api/admin/login',
  '/api/admin/bootstrap',
], authRateLimiter);

app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || !req.cookies?.[SESSION_COOKIE]) return next();
  const origin = req.get('origin');
  if (!origin || !CLIENT_ORIGINS.includes(origin)) {
    return res.status(403).json({ message: 'A valid same-origin request is required' });
  }
  return next();
});

module.exports = { app, readStore, writeStore, makeId, createToken, requireAdmin };

app.locals.locationResolver = resolveLocation;
app.locals.municipalityLister = listOfficialMunicipalities;

async function writeAudit(entry) {
  if (pool) return createAuditLog(entry);
  const store = readStore();
  store.auditLogs.push({ id: makeId('AUDIT'), ...entry, createdAt: new Date().toISOString() });
  writeStore(store);
  return null;
}

async function createBootstrapSuperAdmin(account) {
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN;');
      await client.query('SELECT pg_advisory_xact_lock(19791105);');
      const existing = await client.query("SELECT 1 FROM staff_users WHERE role = 'super_admin' LIMIT 1;");
      if (existing.rowCount) {
        await client.query('ROLLBACK;');
        return false;
      }
      await client.query(
        `INSERT INTO staff_users (id, name, email, password_hash, role)
         VALUES ($1, $2, $3, $4, 'super_admin');`,
        [account.id, account.name, account.email, account.password],
      );
      await client.query('COMMIT;');
      return true;
    } catch (error) {
      await client.query('ROLLBACK;');
      throw error;
    } finally {
      client.release();
    }
  }
  const store = readStore();
  if (store.admins.some((admin) => admin.role === 'super_admin')) return false;
  store.admins.push(account);
  writeStore(store);
  return true;
}

app.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Municipal Service Issue Reporter API is running',
    phase: 'backend-start',
  });
});

app.get('/api/health', async (req, res) => {
  try {
    const reportsCount = pool ? await getReportCountFromDb() : readStore().reports.length;
    return res.status(200).json({
      status: 'ok',
      reportsCount,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return res.status(503).json({ status: 'unavailable' });
  }
});

app.get('/api/auth/session', async (req, res) => {
  const claims = verifyRequestToken(req);
  if (!claims?.id || !['resident', 'admin', 'staff', 'super_admin'].includes(claims.role)) {
    return res.status(200).json({ user: null });
  }

  try {
    let account;
    if (claims.role === 'resident') {
      account = pool
        ? await getResidentByEmail(claims.email)
        : readStore().users.find((user) => user.id === claims.id);
    } else {
      account = pool
        ? await getStaffById(claims.id)
        : readStore().admins.find((admin) => admin.id === claims.id);
    }

    if (!account || account.id !== claims.id || account.isActive === false || account.active === false) {
      clearSessionCookie(res);
      return res.status(200).json({ user: null });
    }

    const role = claims.role === 'resident' ? 'resident' : account.role === 'super_admin' ? 'super_admin' : 'staff';
    return res.status(200).json({
      user: { id: account.id, name: account.name, email: account.email, role },
    });
  } catch (error) {
    console.error('Session lookup failed:', error);
    return res.status(503).json({ message: 'Unable to verify the current session' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  clearSessionCookie(res);
  return res.status(200).json({ message: 'Signed out' });
});

app.post('/api/location/resolve', requireResident, locationRateLimiter, async (req, res) => {
  const { latitude, longitude } = req.body || {};
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return res.status(400).json({ message: 'Choose a map location to continue.' });
  }
  try {
    const location = await app.locals.locationResolver(latitude, longitude);
    if (!location) {
      return res.status(422).json({ message: "We couldn't determine the municipality for this location. Please move the pin and try again." });
    }
    await saveMunicipalityRecord({
      id: location.municipalityId,
      code: location.municipalityId,
      name: location.municipality,
      province: location.province,
      type: location.municipalityType,
      boundarySource: location.boundarySource,
      boundaryDataset: location.boundaryDataset,
    });
    return res.status(200).json({ location });
  } catch (error) {
    console.error('Location resolution failed:', error.message);
    return res.status(503).json({ message: 'Location services are temporarily unavailable. Please try again.' });
  }
});

app.get('/api/staff/municipalities', requireStaff, async (req, res) => {
  try {
    if (req.auth.role === 'super_admin') {
      const municipalities = pool
        ? await listMunicipalities()
        : readStore().municipalities.filter((municipality) => municipality.active !== false);
      return res.status(200).json({ municipalities: municipalities.map(publicMunicipality) });
    }
    const municipalities = pool
      ? await getStaffMunicipalities(req.auth.id)
      : (() => {
        const store = readStore();
        const municipalityIds = new Set(store.staffMunicipalities
          .filter((assignment) => assignment.staffId === req.auth.id)
          .map((assignment) => assignment.municipalityId));
        return store.municipalities.filter((municipality) =>
          municipalityIds.has(municipality.id) && municipality.active !== false,
        );
      })();
    const verifiedMunicipalityId = req.sessionClaims?.municipalityId &&
      await hasVerifiedMunicipalityAccess(req, req.sessionClaims.municipalityId)
      ? req.sessionClaims.municipalityId
      : undefined;
    return res.status(200).json({ municipalities: municipalities.map(publicMunicipality), verifiedMunicipalityId });
  } catch (error) {
    console.error('Staff municipality list failed:', error.message);
    return res.status(503).json({ message: 'Unable to load assigned municipalities right now.' });
  }
});

app.post('/api/staff/municipalities/:id/verify-access', requireStaff, accessCodeRateLimiter, async (req, res) => {
  if (req.auth.role !== 'staff') return res.status(403).json({ message: 'Use the super-admin workspace for municipality management.' });
  const municipalityId = String(req.params.id);
  try {
    if (!await staffAssignedTo(req.auth.id, municipalityId)) {
      return res.status(403).json({ message: 'You are not authorized to manage issues for this municipality.' });
    }
    const municipality = await getMunicipalityRecord(municipalityId);
    if (!municipality?.active || !municipality.accessCodeHash) {
      return res.status(403).json({ message: 'Municipality access is not configured. Contact your administrator.' });
    }
    if (typeof municipality.accessCodeHash !== 'string' || !municipality.accessCodeHash.startsWith('scrypt:') ||
      typeof req.body?.accessCode !== 'string' || !verifyPassword(req.body.accessCode, municipality.accessCodeHash)) {
      return res.status(401).json({ message: 'The access code is incorrect. Please try again.' });
    }
    setSessionCookie(res, {
      ...req.auth,
      role: 'staff',
      municipalityId,
      accessCodeVersion: municipality.accessCodeVersion,
    });
    await writeAudit({
      userId: req.auth.id,
      municipalityId,
      action: 'municipality_access_verified',
    });
    return res.status(200).json({
      message: `Access verified for ${municipality.name}.`,
      municipality: publicMunicipality(municipality),
    });
  } catch (error) {
    console.error('Municipality access verification failed:', error.message);
    return res.status(503).json({ message: 'Unable to verify municipality access right now.' });
  }
});

app.post('/api/staff/municipality/lock', requireStaff, (req, res) => {
  setSessionCookie(res, {
    id: req.auth.id,
    name: req.auth.name,
    email: req.auth.email,
    role: req.auth.role === 'super_admin' ? 'super_admin' : 'staff',
  });
  return res.status(200).json({ message: 'Municipality workspace locked.' });
});

app.post('/api/admin/bootstrap', async (req, res) => {
  const configuredToken = process.env.SUPER_ADMIN_BOOTSTRAP_TOKEN;
  if (!configuredToken) return res.status(503).json({ message: 'Super-admin bootstrap is not configured.' });
  const providedToken = Buffer.from(String(req.body?.bootstrapToken || ''));
  const expectedToken = Buffer.from(configuredToken);
  if (providedToken.length !== expectedToken.length || !crypto.timingSafeEqual(providedToken, expectedToken)) {
    return res.status(403).json({ message: 'A valid bootstrap token is required.' });
  }
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = req.body?.password;
  if (name.length < 2 || name.length > 120 || !/^\S+@\S+\.\S+$/.test(email) ||
      typeof password !== 'string' || password.length < 12 || password.length > 128) {
    return res.status(400).json({ message: 'Enter a valid name, email, and password of at least 12 characters.' });
  }
  const account = {
    id: makeId('ADM'),
    name,
    email,
    password: hashPassword(password),
    role: 'super_admin',
    createdAt: new Date().toISOString(),
  };
  try {
    const created = await createBootstrapSuperAdmin(account);
    if (!created) return res.status(409).json({ message: 'Super-admin bootstrap has already been completed.' });
    setSessionCookie(res, { id: account.id, name, email, role: 'super_admin' });
    return res.status(201).json({
      message: 'Super-admin account created successfully.',
      user: { id: account.id, name, email, role: 'super_admin' },
    });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'An account already exists for this email.' });
    console.error('Super-admin bootstrap failed:', error.message);
    return res.status(500).json({ message: 'Super-admin bootstrap failed.' });
  }
});

app.get('/api/admin/municipalities', requireSuperAdmin, async (req, res) => {
  try {
    const sourceMunicipalities = await app.locals.municipalityLister();
    for (const municipality of sourceMunicipalities) await saveMunicipalityRecord(municipality);
    const municipalities = pool
      ? await listMunicipalities()
      : (() => {
        const store = readStore();
        const reportCounts = new Map();
        for (const report of store.reports) {
          const municipalityId = report.municipalityId || report.location?.municipalityId;
          if (municipalityId) reportCounts.set(municipalityId, (reportCounts.get(municipalityId) || 0) + 1);
        }
        const staffCounts = new Map();
        for (const assignment of store.staffMunicipalities) {
          staffCounts.set(assignment.municipalityId, (staffCounts.get(assignment.municipalityId) || 0) + 1);
        }
        return store.municipalities.map((municipality) => ({
          ...municipality,
          reportCount: reportCounts.get(municipality.id) || 0,
          staffCount: staffCounts.get(municipality.id) || 0,
        }));
      })();
    return res.status(200).json({ municipalities: municipalities.map(publicMunicipality) });
  } catch (error) {
    console.error('Official municipality directory failed:', error.message);
    return res.status(503).json({ message: 'The official municipality directory is temporarily unavailable.' });
  }
});

app.get('/api/admin/staff', requireSuperAdmin, async (req, res) => {
  try {
    const staff = pool
      ? await getStaffDirectoryFromDb()
      : readStore().admins.map(({ id, name, email, role, active }) => ({
        id, name, email, role: role || 'staff', active: active !== false,
      }));
    const staffWithMunicipalities = await Promise.all(staff.map(async (member) => {
      const municipalities = pool
        ? await getStaffMunicipalities(member.id)
        : (() => {
          const store = readStore();
          const ids = new Set(store.staffMunicipalities.filter((item) => item.staffId === member.id).map((item) => item.municipalityId));
          return store.municipalities.filter((item) => ids.has(item.id)).map(publicMunicipality);
        })();
      return {
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role || 'staff',
        active: member.isActive !== false && member.active !== false,
        municipalities: municipalities.map(publicMunicipality),
      };
    }));
    return res.status(200).json({ staff: staffWithMunicipalities });
  } catch (error) {
    console.error('Staff directory fetch failed:', error.message);
    return res.status(503).json({ message: 'Unable to load staff directory.' });
  }
});

app.post('/api/admin/staff/:staffId/municipalities/:municipalityId', requireSuperAdmin, async (req, res) => {
  const { staffId, municipalityId } = req.params;
  try {
    const member = pool
      ? await getStaffById(staffId)
      : readStore().admins.find((admin) => admin.id === staffId);
    const municipality = await getMunicipalityRecord(municipalityId);
    if (!member || member.isActive === false || member.active === false ||
      (member.role && member.role !== 'staff') || !municipality?.active) {
      return res.status(404).json({ message: 'Staff member or municipality not found.' });
    }
    if (pool) {
      await assignStaffMunicipality(staffId, municipalityId);
    } else {
      const store = readStore();
      if (!store.staffMunicipalities.some((item) => item.staffId === staffId && item.municipalityId === municipalityId)) {
        store.staffMunicipalities.push({ staffId, municipalityId, createdAt: new Date().toISOString() });
        writeStore(store);
      }
    }
    await writeAudit({ userId: req.auth.id, municipalityId, action: 'staff_municipality_assigned', details: { staffId } });
    return res.status(200).json({ message: 'Staff municipality access assigned.' });
  } catch (error) {
    console.error('Staff assignment failed:', error.message);
    return res.status(503).json({ message: 'Unable to assign staff access right now.' });
  }
});

app.delete('/api/admin/staff/:staffId/municipalities/:municipalityId', requireSuperAdmin, async (req, res) => {
  const { staffId, municipalityId } = req.params;
  try {
    const removed = pool
      ? await removeStaffMunicipality(staffId, municipalityId)
      : (() => {
        const store = readStore();
        const before = store.staffMunicipalities.length;
        store.staffMunicipalities = store.staffMunicipalities.filter((item) =>
          item.staffId !== staffId || item.municipalityId !== municipalityId,
        );
        if (before !== store.staffMunicipalities.length) writeStore(store);
        return before !== store.staffMunicipalities.length;
      })();
    if (!removed) return res.status(404).json({ message: 'Staff assignment not found.' });
    await writeAudit({ userId: req.auth.id, municipalityId, action: 'staff_municipality_removed', details: { staffId } });
    return res.status(200).json({ message: 'Staff municipality access removed.' });
  } catch (error) {
    console.error('Staff assignment removal failed:', error.message);
    return res.status(503).json({ message: 'Unable to remove staff access right now.' });
  }
});

app.patch('/api/admin/staff/:staffId/active', requireSuperAdmin, async (req, res) => {
  const active = req.body?.active;
  if (typeof active !== 'boolean') return res.status(400).json({ message: 'active must be a boolean.' });
  try {
    const updated = pool
      ? await setStaffActive(req.params.staffId, active)
      : (() => {
        const store = readStore();
        const member = store.admins.find((admin) => admin.id === req.params.staffId && admin.role !== 'super_admin');
        if (!member) return null;
        member.active = active;
        writeStore(store);
        return { id: member.id, active };
      })();
    if (!updated) return res.status(404).json({ message: 'Staff member not found.' });
    await writeAudit({ userId: req.auth.id, action: active ? 'staff_activated' : 'staff_deactivated', details: { staffId: req.params.staffId } });
    return res.status(200).json({ message: active ? 'Staff member activated.' : 'Staff member deactivated.' });
  } catch (error) {
    console.error('Staff activation update failed:', error.message);
    return res.status(503).json({ message: 'Unable to update staff status right now.' });
  }
});

app.patch('/api/admin/municipalities/:id/active', requireSuperAdmin, async (req, res) => {
  const active = req.body?.active;
  if (typeof active !== 'boolean') return res.status(400).json({ message: 'active must be a boolean.' });
  const municipalityId = String(req.params.id);
  try {
    const updated = pool
      ? await setMunicipalityActive(municipalityId, active)
      : (() => {
        const store = readStore();
        const municipality = store.municipalities.find((item) => item.id === municipalityId);
        if (!municipality) return null;
        municipality.active = active;
        municipality.accessCodeVersion = Number(municipality.accessCodeVersion || 0) + 1;
        writeStore(store);
        return municipality;
      })();
    if (!updated) return res.status(404).json({ message: 'Municipality not found.' });
    await writeAudit({ userId: req.auth.id, municipalityId, action: active ? 'municipality_activated' : 'municipality_deactivated' });
    return res.status(200).json({ message: active ? 'Municipality activated.' : 'Municipality deactivated.' });
  } catch (error) {
    console.error('Municipality status update failed:', error.message);
    return res.status(503).json({ message: 'Unable to update municipality status right now.' });
  }
});

app.post('/api/admin/municipalities/:id/access-code', requireSuperAdmin, async (req, res) => {
  const municipalityId = String(req.params.id);
  try {
    const municipality = await getMunicipalityRecord(municipalityId);
    if (!municipality) return res.status(404).json({ message: 'Municipality not found.' });
    const accessCode = String(req.body?.accessCode || '').trim();
    if (accessCode.length < 8 || accessCode.length > 128) {
      return res.status(400).json({ message: 'Access codes must be between 8 and 128 characters.' });
    }
    const updated = pool
      ? await setMunicipalityAccessCode(municipalityId, hashPassword(accessCode))
      : (() => {
        const store = readStore();
        const record = store.municipalities.find((item) => item.id === municipalityId);
        if (!record) return null;
        record.accessCodeHash = hashPassword(accessCode);
        record.accessCodeVersion = Number(record.accessCodeVersion || 0) + 1;
        record.updatedAt = new Date().toISOString();
        writeStore(store);
        return record;
      })();
    if (!updated) return res.status(404).json({ message: 'Municipality not found.' });
    await writeAudit({
      userId: req.auth.id,
      municipalityId,
      action: 'municipality_access_code_saved',
    });
    return res.status(200).json({ message: 'The municipality access code was saved and previous staff verification was invalidated.' });
  } catch (error) {
    console.error('Municipality access-code generation failed:', error.message);
    return res.status(503).json({ message: 'Unable to generate an access code right now.' });
  }
});

app.get('/api/reports', async (req, res) => {
  const { category, status, search } = req.query;

  if (pool) {
    try {
      const reports = await getReportsFromDb({ category, status, search });
      const allReports = await getReportsFromDb();
      return res.status(200).json({ reports: reports.map((report) => withDuplicateReferences(report, allReports)) });
    } catch (error) {
      console.error('Database report fetch failed:', error);
      return res.status(500).json({ message: 'Failed to fetch reports from database' });
    }
  }

  const store = readStore();

  let reports = [...store.reports];

  if (category) {
    const normalizedCategory = String(category).trim().toLowerCase();
    reports = reports.filter(
      (report) => String(report.category || '').trim().toLowerCase() === normalizedCategory,
    );
  }

  if (status) {
    const normalizedStatus = String(status).trim().toLowerCase();
    reports = reports.filter(
      (report) => String(report.status || '').trim().toLowerCase() === normalizedStatus,
    );
  }

  if (search) {
    const normalizedSearch = String(search).trim().toLowerCase();
    reports = reports.filter((report) => {
      const haystack = [
        report.title,
        report.category,
        report.description,
        report.location?.city,
        report.location?.municipality,
        report.location?.address,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }

  return res.status(200).json({ reports: reports.map((report) => withDuplicateReferences(report, store.reports)) });
});

app.get('/api/my/reports', requireResident, async (req, res) => {
  if (pool) {
    try {
      const reports = await getReportsFromDb({ residentId: req.auth.id });
      return res.status(200).json({ reports: reports.map(publicReport) });
    } catch (error) {
      console.error('Resident report fetch failed:', error);
      return res.status(503).json({ message: 'Unable to load your reports right now' });
    }
  }

  const store = readStore();
  const reports = store.reports.filter((report) => report.residentId === req.auth.id);
  return res.status(200).json({ reports: reports.map(publicReport) });
});

app.get('/api/admin/reports', requireAdmin, async (req, res) => {
  try {
    const scopedMunicipalityId = await requireActiveMunicipality(req, res);
    if (scopedMunicipalityId === undefined) return;
    const municipalityId = req.auth.role === 'super_admin'
      ? String(req.query.municipalityId || '') || undefined
      : scopedMunicipalityId;
    const reports = pool
      ? await getReportsFromDb({ municipalityId: municipalityId || undefined })
      : readStore().reports.filter((report) => !municipalityId ||
        (report.municipalityId || report.location?.municipalityId) === municipalityId);
    const visibleReports = reports.map(req.auth.role === 'super_admin' ? publicReport : staffReportSummary);
    return res.status(200).json({ reports: visibleReports });
  } catch (error) {
    console.error('Staff report fetch failed:', error);
    return res.status(500).json({ message: 'Failed to fetch staff reports' });
  }
});

app.get('/api/staff/directory', requireOperationalStaff, async (req, res) => {
  const municipalityId = await requireActiveMunicipality(req, res);
  if (municipalityId === undefined) return;
  try {
    const candidates = pool ? await getStaffDirectoryFromDb() : readStore().admins;
    const assignedStaff = await Promise.all(candidates
      .filter((member) => (member.role || 'staff') === 'staff' && member.isActive !== false && member.active !== false)
      .map(async (member) => await staffAssignedTo(member.id, municipalityId) ? {
        id: member.id,
        name: member.name,
        email: member.email,
      } : null));
    return res.status(200).json({ staff: assignedStaff.filter(Boolean) });
  } catch (error) {
    console.error('Assigned staff directory fetch failed:', error.message);
    return res.status(503).json({ message: 'Unable to load staff assigned to this municipality.' });
  }
});

app.get('/api/admin/reports/:id', requireOperationalStaff, async (req, res) => {
  try {
    const report = await findAuthorizedReport(req, req.params.id, res);
    if (!report) return;
    const municipalityId = report.municipalityId || report.location?.municipalityId;
    const reports = pool
      ? await getReportsFromDb(req.auth.role === 'super_admin' ? {} : { municipalityId })
      : readStore().reports.filter((candidate) =>
        (req.auth.role === 'super_admin' || (candidate.municipalityId || candidate.location?.municipalityId) === municipalityId));
    const duplicateReports = reports.filter((candidate) => candidate.duplicateOf === report.id).map(({ id, title }) => ({ id, title }));
    return res.status(200).json({ report: { ...report, duplicateReports } });
  } catch (error) {
    console.error('Staff report detail fetch failed:', error);
    return res.status(500).json({ message: 'Failed to fetch staff report detail' });
  }
});

app.get('/api/categories', async (req, res) => {
  if (pool) {
    try {
      const categories = await getCategoriesFromDb();
      return res.status(200).json({
        categories: categories.map((category) => category.name || category.slug || 'Other Municipal Issue'),
      });
    } catch (error) {
      console.error('Database category fetch failed:', error);
      return res.status(500).json({ message: 'Failed to fetch categories from database' });
    }
  }

  return res.status(200).json({
    categories: [
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
    ],
  });
});

app.get('/api/reports/:id', async (req, res) => {
  if (pool) {
    try {
      const reports = await getReportsFromDb();
      const report = reports.find((item) => item.id === req.params.id);

      if (!report) {
        return res.status(404).json({ message: 'Report not found' });
      }

      return res.status(200).json({ report: withDuplicateReferences(report, reports) });
    } catch (error) {
      console.error('Database single report fetch failed:', error);
      return res.status(500).json({ message: 'Failed to fetch report from database' });
    }
  }

  const store = readStore();
  const report = store.reports.find((item) => item.id === req.params.id);

  if (!report) {
    return res.status(404).json({ message: 'Report not found' });
  }

  return res.status(200).json({ report: withDuplicateReferences(report, store.reports) });
});

app.post('/api/reports', reportRateLimiter, requireResident, async (req, res) => {
  const validationError = validateIssuePayload(req.body);

  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  let resolvedLocation;
  try {
    resolvedLocation = await app.locals.locationResolver(
      Number(req.body.location.latitude),
      Number(req.body.location.longitude),
    );
    if (!resolvedLocation) {
      return res.status(422).json({ message: "We couldn't determine the municipality for this location. Please move the pin and try again." });
    }
  } catch (error) {
    console.error('Report location resolution failed:', error.message);
    return res.status(503).json({ message: 'Location services are temporarily unavailable. Please try again.' });
  }

  const municipality = await saveMunicipalityRecord({
    id: resolvedLocation.municipalityId,
    code: resolvedLocation.municipalityId,
    name: resolvedLocation.municipality,
    province: resolvedLocation.province,
    type: resolvedLocation.municipalityType,
    boundarySource: resolvedLocation.boundarySource,
    boundaryDataset: resolvedLocation.boundaryDataset,
  });
  if (!municipality?.active) return res.status(422).json({ message: 'This municipality is not accepting reports right now.' });
  resolvedLocation.municipalityId = municipality.id;

  if (pool) {
    try {
      const report = await createReportInDb({
        title: req.body.title,
        category: req.body.category,
        description: req.body.description,
        location: resolvedLocation,
        priority: req.body.priority,
        reportedBy: req.auth.name,
        residentId: req.auth.id,
        image: req.body.image,
      });

      return res.status(201).json({
        message: 'Report created successfully',
        report: publicReport(report),
      });
    } catch (error) {
      console.error('Database report creation failed:', error);
      return res.status(500).json({ message: 'Failed to create report in database' });
    }
  }

  const store = readStore();
  const newReport = {
    id: makeId('MSR'),
    title: req.body.title,
    category: req.body.category,
    description: req.body.description,
    municipalityId: municipality.id,
    location: resolvedLocation,
    priority: req.body.priority || 'Medium',
    status: 'Reported',
    reportedBy: req.auth.name,
    residentId: req.auth.id,
    reportedAt: new Date().toISOString(),
    image: req.body.image || undefined,
  };

  store.reports.unshift(newReport);
  writeStore(store);

  return res.status(201).json({
    message: 'Report created successfully',
    report: publicReport(newReport),
  });
});

app.patch('/api/reports/:id/status', requireOperationalStaff, async (req, res) => {
  const { status } = req.body || {};

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      message: 'A valid status is required',
      validStatuses: VALID_STATUSES,
    });
  }

  const authorizedReport = await findAuthorizedReport(req, req.params.id, res);
  if (!authorizedReport) return;

  if (pool) {
    try {
      const report = await updateReportStatusInDb(req.params.id, status, databaseAuthorizationScope(req));

      if (!report) {
        return res.status(req.auth.role === 'staff' ? 403 : 404).json({ message: 'Report is no longer available to this municipality.' });
      }

      return res.status(200).json({
        message: 'Report status updated successfully',
        report: publicReport(report),
      });
    } catch (error) {
      console.error('Database status update failed:', error);
      return res.status(500).json({ message: 'Failed to update report status in database' });
    }
  }

  const store = readStore();
  const reportIndex = store.reports.findIndex((report) => report.id === req.params.id);

  if (reportIndex === -1) {
    return res.status(404).json({ message: 'Report not found' });
  }

  store.reports[reportIndex].status = status;
  writeStore(store);
  await writeAudit({ userId: req.auth.id, municipalityId: store.reports[reportIndex].municipalityId, reportId: req.params.id, action: 'report_status_changed', details: { status } });

  return res.status(200).json({
    message: 'Report status updated successfully',
    report: publicReport(store.reports[reportIndex]),
  });
});

app.patch('/api/reports/:id/triage', requireOperationalStaff, async (req, res) => {
  const payload = req.body || {};
  const allowedFields = ['status', 'category', 'priority', 'verified', 'department', 'maintenanceTeam', 'assignedStaffId', 'duplicateOf'];
  if (Object.keys(payload).some((field) => !allowedFields.includes(field))) {
    return res.status(400).json({ message: 'Unsupported triage field' });
  }
  if (payload.status !== undefined && !VALID_STATUSES.includes(payload.status)) {
    return res.status(400).json({ message: 'A valid status is required', validStatuses: VALID_STATUSES });
  }
  if (payload.priority !== undefined && !VALID_PRIORITIES.includes(payload.priority)) {
    return res.status(400).json({ message: 'A valid priority is required', validPriorities: VALID_PRIORITIES });
  }
  if (payload.category !== undefined && (typeof payload.category !== 'string' || !payload.category.trim())) {
    return res.status(400).json({ message: 'A non-empty category is required' });
  }
  if (payload.verified !== undefined && typeof payload.verified !== 'boolean') {
    return res.status(400).json({ message: 'verified must be a boolean' });
  }

  try {
    const current = await findAuthorizedReport(req, req.params.id, res);
    if (!current) return;
    const municipalityId = current.municipalityId || current.location?.municipalityId;

    const updates = {};
    for (const field of ['status', 'priority', 'department', 'maintenanceTeam']) {
      if (payload[field] !== undefined) updates[field] = String(payload[field]).trim();
    }
    if (payload.category !== undefined) updates.category = payload.category.trim();
    if (payload.verified !== undefined) {
      updates.verified = payload.verified;
      updates.verifiedAt = payload.verified ? new Date().toISOString() : undefined;
      updates.verifiedBy = payload.verified ? req.staff.id : undefined;
    }
    if (payload.assignedStaffId !== undefined) {
      if (payload.assignedStaffId === '') {
        updates.assignedStaffId = undefined;
        updates.assignedStaffName = undefined;
      } else {
        const assignee = pool
          ? await getStaffByIdFromDb(payload.assignedStaffId)
          : readStore().admins.find((entry) => entry.id === payload.assignedStaffId);
        if (!assignee || assignee.role === 'super_admin' || !await staffAssignedTo(assignee.id, municipalityId)) {
          return res.status(400).json({ message: 'Choose a staff member assigned to this municipality.' });
        }
        updates.assignedStaffId = assignee.id;
        updates.assignedStaffName = assignee.name;
      }
    }
    if (payload.duplicateOf !== undefined) {
      if (payload.duplicateOf === '') {
        updates.duplicateOf = undefined;
      } else {
        if (payload.duplicateOf === req.params.id) return res.status(400).json({ message: 'A report cannot duplicate itself' });
        const duplicateTarget = await findReport(payload.duplicateOf);
        if (!duplicateTarget) return res.status(400).json({ message: 'Duplicate target was not found' });
        if ((duplicateTarget.municipalityId || duplicateTarget.location?.municipalityId) !== municipalityId) {
          return res.status(400).json({ message: 'Duplicate reports must belong to the same municipality.' });
        }
        updates.duplicateOf = duplicateTarget.id;
      }
    }

    const merged = { ...current, ...updates };
    const report = await saveReportOperations(req.params.id, merged, req);
    if (!report) return res.status(403).json({ message: 'Municipality access is no longer authorized.' });
    await writeAudit({ userId: req.auth.id, municipalityId, reportId: req.params.id, action: 'report_triage_updated', details: { fields: Object.keys(updates) } });
    return res.status(200).json({ message: 'Report triage updated', report: staffReportSummary(report) });
  } catch (error) {
    console.error('Report triage update failed:', error);
    return res.status(500).json({ message: 'Failed to update report triage' });
  }
});

app.post('/api/reports/:id/notes', requireOperationalStaff, async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text || text.length > 4000) return res.status(400).json({ message: 'Note must contain 1 to 4000 characters' });
  try {
    const report = await findAuthorizedReport(req, req.params.id, res);
    if (!report) return;
    const note = { id: makeId('NOTE'), authorId: req.staff.id, authorName: req.staff.name || 'Municipal Staff', text, createdAt: new Date().toISOString() };
    const updated = await saveReportOperations(req.params.id, { ...report, staffNotes: [...(report.staffNotes || []), note] }, req);
    if (!updated) return res.status(403).json({ message: 'Municipality access is no longer authorized.' });
    await writeAudit({ userId: req.auth.id, municipalityId: report.municipalityId, reportId: req.params.id, action: 'staff_note_added' });
    return res.status(201).json({ note, report: updated });
  } catch (error) {
    console.error('Staff note creation failed:', error);
    return res.status(500).json({ message: 'Failed to add staff note' });
  }
});

app.post('/api/reports/:id/updates', requireOperationalStaff, async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  const status = req.body?.status;
  if (!text || text.length > 4000 || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ message: 'A valid status and update text of 1 to 4000 characters are required' });
  }
  try {
    const report = await findAuthorizedReport(req, req.params.id, res);
    if (!report) return;
    const update = { id: makeId('UPDATE'), authorId: req.staff.id, authorName: req.staff.name || 'Municipal Staff', text, status, createdAt: new Date().toISOString() };
    const updated = await saveReportOperations(req.params.id, { ...report, status, residentUpdates: [...(report.residentUpdates || []), update] }, req);
    if (!updated) return res.status(403).json({ message: 'Municipality access is no longer authorized.' });
    await writeAudit({ userId: req.auth.id, municipalityId: report.municipalityId, reportId: req.params.id, action: 'resident_update_published', details: { status } });
    return res.status(201).json({ update, report: publicReport(updated) });
  } catch (error) {
    console.error('Resident status update creation failed:', error);
    return res.status(500).json({ message: 'Failed to publish resident update' });
  }
});

app.delete('/api/reports', requireSuperAdmin, async (req, res) => {
  if (pool) {
    try {
      const removedCount = await deleteAllReportsInDb();
      return res.status(200).json({
        message: 'All reports deleted successfully',
        removedCount,
      });
    } catch (error) {
      console.error('Database reset failed:', error);
      return res.status(500).json({ message: 'Failed to reset database reports' });
    }
  }

  const store = readStore();
  const removedCount = store.reports.length;
  store.reports = [];
  writeStore(store);

  return res.status(200).json({
    message: 'All reports deleted successfully',
    removedCount,
  });
});

app.delete('/api/reports/:id', requireSuperAdmin, async (req, res) => {
  if (pool) {
    try {
      const deleted = await deleteReportInDb(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: 'Report not found' });
      }

      return res.status(200).json({ message: 'Report deleted successfully' });
    } catch (error) {
      console.error('Database report deletion failed:', error);
      return res.status(500).json({ message: 'Failed to delete report from database' });
    }
  }

  const store = readStore();
  const originalLength = store.reports.length;
  store.reports = store.reports.filter((report) => report.id !== req.params.id);

  if (store.reports.length === originalLength) {
    return res.status(404).json({ message: 'Report not found' });
  }

  writeStore(store);

  return res.status(200).json({ message: 'Report deleted successfully' });
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required' });
  }

  const normalizedName = String(name).trim();
  const normalizedEmail = String(email).trim().toLowerCase();
  if (normalizedName.length < 2 || normalizedName.length > 120 || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    return res.status(400).json({ message: 'Enter a valid name and email address' });
  }
  if (String(password).length < 12 || String(password).length > 128) {
    return res.status(400).json({ message: 'Password must be between 12 and 128 characters' });
  }

  const user = {
    id: makeId('USR'),
    name: normalizedName,
    email: normalizedEmail,
    password: hashPassword(password),
    phone: String(req.body.phone || '').trim(),
    createdAt: new Date().toISOString(),
  };

  try {
    if (pool) {
      await createResidentInDb(user);
    } else {
      const store = readStore();
      if (store.users.some((account) => account.email.toLowerCase() === normalizedEmail)) {
        return res.status(409).json({ message: 'User already exists' });
      }
      store.users.push(user);
      writeStore(store);
    }

    setSessionCookie(res, { id: user.id, name: user.name, email: user.email, role: 'resident' });
    return res.status(201).json({
      message: 'Resident registered successfully',
      user: { id: user.id, name: user.name, email: user.email, role: 'resident' },
    });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'User already exists' });
    console.error('Resident registration failed:', error);
    return res.status(500).json({ message: 'Resident registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  let user;
  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    user = pool
      ? await getResidentByEmail(normalizedEmail)
      : readStore().users.find((record) => record.email.toLowerCase() === normalizedEmail);
  } catch (error) {
    console.error('Resident login lookup failed:', error);
    return res.status(503).json({ message: 'Resident sign-in is temporarily unavailable' });
  }

  if (!user || !verifyPassword(password, user.password)) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  if (!String(user.password).startsWith('scrypt:')) {
    if (pool) {
      return res.status(401).json({ message: 'This account must reset its password before signing in' });
    }
    const store = readStore();
    const storedUser = store.users.find((record) => record.id === user.id);
    if (storedUser) {
      storedUser.password = hashPassword(password);
      writeStore(store);
      user.password = storedUser.password;
    }
  }

  setSessionCookie(res, { id: user.id, name: user.name, email: user.email, role: 'resident' });
  return res.status(200).json({
    message: 'Resident login successful',
    user: { id: user.id, name: user.name, email: user.email, role: 'resident' },
  });
});

app.post('/api/admin/register', async (req, res) => {
  const { name, email, password, registrationKey } = req.body || {};

  const registrationKeys = [process.env.ADMIN_REGISTRATION_KEYS, process.env.ADMIN_REGISTRATION_KEY]
    .filter(Boolean)
    .flatMap((value) => value.split(',').map((key) => key.trim()).filter(Boolean));
  if (registrationKeys.length === 0) {
    return res.status(503).json({ message: 'Staff registration is not configured' });
  }
  const submittedKey = Buffer.from(String(registrationKey || ''));
  const validKey = registrationKeys.some((key) => {
    const configuredKey = Buffer.from(key);
    return submittedKey.length === configuredKey.length && crypto.timingSafeEqual(submittedKey, configuredKey);
  });
  if (!validKey) {
    return res.status(403).json({ message: 'A valid staff registration key is required' });
  }

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required' });
  }

  const normalizedName = String(name).trim();
  const normalizedEmail = String(email).trim().toLowerCase();
  if (normalizedName.length < 2 || normalizedName.length > 120 || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    return res.status(400).json({ message: 'Enter a valid name and email address' });
  }
  if (String(password).length < 12 || String(password).length > 128) {
    return res.status(400).json({ message: 'Password must be between 12 and 128 characters' });
  }

  const admin = {
    id: makeId('ADM'),
    name: normalizedName,
    email: normalizedEmail,
    password: hashPassword(password),
    role: 'staff',
    createdAt: new Date().toISOString(),
  };

  try {
    if (pool) {
      await createStaffInDb(admin);
    } else {
      const store = readStore();
      if (store.admins.some((account) => account.email.toLowerCase() === admin.email)) {
        return res.status(409).json({ message: 'Admin already exists' });
      }
      store.admins.push(admin);
      writeStore(store);
    }

    setSessionCookie(res, { id: admin.id, name: admin.name, email: admin.email, role: 'staff' });
    return res.status(201).json({
      message: 'Admin registered successfully',
      admin: { id: admin.id, name: admin.name, email: admin.email, role: 'staff' },
    });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'Admin already exists' });
    console.error('Staff registration failed:', error);
    return res.status(500).json({ message: 'Staff registration failed' });
  }
});

app.post('/api/admin/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  let admin;
  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    admin = pool
      ? await getStaffByEmail(normalizedEmail)
      : readStore().admins.find((record) => record.email.toLowerCase() === normalizedEmail);
  } catch (error) {
    console.error('Staff login lookup failed:', error);
    return res.status(503).json({ message: 'Staff sign-in is temporarily unavailable' });
  }

  if (!admin || admin.isActive === false || admin.active === false || !verifyPassword(password, admin.password)) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  if (!String(admin.password).startsWith('scrypt:')) {
    if (pool) return res.status(401).json({ message: 'This account must reset its password before signing in' });
    const store = readStore();
    const storedAdmin = store.admins.find((record) => record.id === admin.id);
    if (storedAdmin) {
      storedAdmin.password = hashPassword(password);
      writeStore(store);
      admin.password = storedAdmin.password;
    }
  }

  const role = admin.role === 'super_admin' ? 'super_admin' : 'staff';
  setSessionCookie(res, { id: admin.id, name: admin.name, email: admin.email, role });

  return res.status(200).json({
    message: 'Admin login successful',
    admin: { id: admin.id, name: admin.name, email: admin.email, role },
  });
});

app.use((error, req, res, next) => {
  console.error('Unhandled server error:', error);
  res.status(500).json({ message: 'Internal server error' });
});

if (require.main === module) {
  if (process.env.NODE_ENV === 'production' && !pool) {
    console.error('DATABASE_URL is required in production; refusing to start with file storage.');
    process.exitCode = 1;
  } else {
  initDatabase()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Municipal Service Server listening on port ${PORT}`);
        console.log(`Database enabled: ${Boolean(pool)}`);
        console.log(`Store path: ${STORE_PATH}`);
      });
    })
    .catch(async (error) => {
      console.error('Database initialization failed:', error);
      if (pool) {
        await pool.end();
        process.exitCode = 1;
        return;
      }
      app.listen(PORT, () => {
        console.log(`Municipal Service Server listening on port ${PORT}`);
        console.log(`Store path: ${STORE_PATH}`);
      });
    });
  }
}
