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
  getStaffByIdFromDb,
  createStaffInDb,
  getStaffDirectoryFromDb,
  DEFAULT_CATEGORIES,
  pool,
} = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;
const SESSION_COOKIE = 'msr_session';
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGIN || 'http://localhost:3000,https://cs-municipal-service-issue-reporter.vercel.app')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
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
  return (req, res, next) => {
    const claims = verifyRequestToken(req);
    if (!claims?.id) return res.status(401).json({ message: 'Authentication is required' });
    if (claims.role !== role) return res.status(403).json({ message: 'Access is not permitted' });
    req.auth = { id: claims.id, email: claims.email, name: claims.name, role: claims.role };
    if (role === 'admin') req.staff = req.auth;
    return next();
  };
}

const requireAdmin = requireRole('admin');
const requireResident = requireRole('resident');

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

  if (!String(payload.location.city || '').trim() || !String(payload.location.municipality || '').trim()) {
    return 'City and municipality are required';
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

async function saveReportOperations(reportId, operations) {
  if (pool) {
    return updateReportOperationsInDb(reportId, operations);
  }
  const store = readStore();
  const report = store.reports.find((entry) => entry.id === reportId);
  if (!report) return null;
  Object.assign(report, operations);
  writeStore(store);
  return report;
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
app.use([
  '/api/auth/register',
  '/api/auth/login',
  '/api/admin/register',
  '/api/admin/login',
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
  if (!claims?.id || !['resident', 'admin'].includes(claims.role)) {
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
        ? await getStaffByEmail(claims.email)
        : readStore().admins.find((admin) => admin.id === claims.id);
    }

    if (!account || account.id !== claims.id) {
      clearSessionCookie(res);
      return res.status(200).json({ user: null });
    }

    return res.status(200).json({
      user: { id: account.id, name: account.name, email: account.email, role: claims.role },
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
      return res.status(200).json({ reports });
    } catch (error) {
      console.error('Resident report fetch failed:', error);
      return res.status(503).json({ message: 'Unable to load your reports right now' });
    }
  }

  const store = readStore();
  const reports = store.reports.filter((report) => report.residentId === req.auth.id);
  return res.status(200).json({ reports });
});

app.get('/api/admin/reports', requireAdmin, async (req, res) => {
  try {
    const reports = pool ? await getReportsFromDb() : readStore().reports;
    return res.status(200).json({ reports: reports.map(staffReportSummary) });
  } catch (error) {
    console.error('Staff report fetch failed:', error);
    return res.status(500).json({ message: 'Failed to fetch staff reports' });
  }
});

app.get('/api/admin/reports/:id', requireAdmin, async (req, res) => {
  try {
    const report = await findReport(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found' });
    const reports = pool ? await getReportsFromDb() : readStore().reports;
    const duplicateReports = reports.filter((candidate) => candidate.duplicateOf === report.id).map(({ id, title }) => ({ id, title }));
    return res.status(200).json({ report: { ...report, duplicateReports } });
  } catch (error) {
    console.error('Staff report detail fetch failed:', error);
    return res.status(500).json({ message: 'Failed to fetch staff report detail' });
  }
});

app.get('/api/admin/staff', requireAdmin, async (req, res) => {
  try {
    const staff = pool
      ? await getStaffDirectoryFromDb()
      : readStore().admins.map(({ id, name, email }) => ({ id, name, email }));
    return res.status(200).json({ staff });
  } catch (error) {
    console.error('Staff directory fetch failed:', error);
    return res.status(503).json({ message: 'Unable to load staff directory' });
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

  if (pool) {
    try {
      const report = await createReportInDb({
        title: req.body.title,
        category: req.body.category,
        description: req.body.description,
        location: req.body.location,
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
    location: {
      latitude: Number(req.body.location.latitude),
      longitude: Number(req.body.location.longitude),
      address: req.body.location.address || '',
      city: req.body.location.city || '',
      municipality: req.body.location.municipality || '',
    },
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

app.patch('/api/reports/:id/status', requireAdmin, async (req, res) => {
  const { status } = req.body || {};

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      message: 'A valid status is required',
      validStatuses: VALID_STATUSES,
    });
  }

  if (pool) {
    try {
      const report = await updateReportStatusInDb(req.params.id, status);

      if (!report) {
        return res.status(404).json({ message: 'Report not found' });
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

  return res.status(200).json({
    message: 'Report status updated successfully',
    report: publicReport(store.reports[reportIndex]),
  });
});

app.patch('/api/reports/:id/triage', requireAdmin, async (req, res) => {
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
    const current = await findReport(req.params.id);
    if (!current) return res.status(404).json({ message: 'Report not found' });

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
        if (!assignee) return res.status(400).json({ message: 'Assigned staff member was not found' });
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
        updates.duplicateOf = duplicateTarget.id;
      }
    }

    const merged = { ...current, ...updates };
    const report = await saveReportOperations(req.params.id, merged);
    return res.status(200).json({ message: 'Report triage updated', report: staffReportSummary(report) });
  } catch (error) {
    console.error('Report triage update failed:', error);
    return res.status(500).json({ message: 'Failed to update report triage' });
  }
});

app.post('/api/reports/:id/notes', requireAdmin, async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text || text.length > 4000) return res.status(400).json({ message: 'Note must contain 1 to 4000 characters' });
  try {
    const report = await findReport(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found' });
    const admins = readStore().admins;
    const author = admins.find((entry) => entry.id === req.staff.id);
    const note = { id: makeId('NOTE'), authorId: req.staff.id, authorName: author?.name || 'Municipal Staff', text, createdAt: new Date().toISOString() };
    const updated = await saveReportOperations(req.params.id, { ...report, staffNotes: [...(report.staffNotes || []), note] });
    return res.status(201).json({ note, report: updated });
  } catch (error) {
    console.error('Staff note creation failed:', error);
    return res.status(500).json({ message: 'Failed to add staff note' });
  }
});

app.post('/api/reports/:id/updates', requireAdmin, async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  const status = req.body?.status;
  if (!text || text.length > 4000 || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ message: 'A valid status and update text of 1 to 4000 characters are required' });
  }
  try {
    const report = await findReport(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found' });
    const author = readStore().admins.find((entry) => entry.id === req.staff.id);
    const update = { id: makeId('UPDATE'), authorId: req.staff.id, authorName: author?.name || 'Municipal Staff', text, status, createdAt: new Date().toISOString() };
    const updated = await saveReportOperations(req.params.id, { ...report, status, residentUpdates: [...(report.residentUpdates || []), update] });
    return res.status(201).json({ update, report: publicReport(updated) });
  } catch (error) {
    console.error('Resident status update creation failed:', error);
    return res.status(500).json({ message: 'Failed to publish resident update' });
  }
});

app.delete('/api/reports', requireAdmin, async (req, res) => {
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

app.delete('/api/reports/:id', requireAdmin, async (req, res) => {
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

    setSessionCookie(res, { id: admin.id, name: admin.name, email: admin.email, role: 'admin' });
    return res.status(201).json({
      message: 'Admin registered successfully',
      admin: { id: admin.id, name: admin.name, email: admin.email, role: 'admin' },
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

  if (!admin || !verifyPassword(password, admin.password)) {
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

  setSessionCookie(res, { id: admin.id, name: admin.name, email: admin.email, role: 'admin' });

  return res.status(200).json({
    message: 'Admin login successful',
    admin: { id: admin.id, name: admin.name, email: admin.email, role: 'admin' },
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
    .catch((error) => {
      console.error('Database initialization failed:', error);
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
      app.listen(PORT, () => {
        console.log(`Municipal Service Server listening on port ${PORT}`);
        console.log(`Store path: ${STORE_PATH}`);
      });
    });
  }
}
