require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '.env.staff-invites') });
const {
  initDatabase,
  getCategoriesFromDb,
  getReportsFromDb,
  createReportInDb,
  updateReportStatusInDb,
  updateReportOperationsInDb,
  deleteReportInDb,
  deleteAllReportsInDb,
  pool,
} = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;
const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

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

function requireAdmin(req, res, next) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const secret = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'test-only-secret' : null);

  if (!token || !secret) {
    return res.status(401).json({ message: 'Staff authentication is required' });
  }

  try {
    const claims = jwt.verify(token, secret);
    if (claims.role !== 'admin' || !claims.id) {
      return res.status(403).json({ message: 'Staff access is required' });
    }
    req.staff = { id: claims.id, email: claims.email };
    return next();
  } catch {
    return res.status(401).json({ message: 'A valid staff token is required' });
  }
}

function validateIssuePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'Request body is required';
  }

  if (!payload.title || !payload.description || !payload.category) {
    return 'Title, description, and category are required';
  }

  if (!payload.location || typeof payload.location !== 'object') {
    return 'Location is required';
  }

  if (
    typeof payload.location.latitude !== 'number' ||
    typeof payload.location.longitude !== 'number'
  ) {
    return 'Latitude and longitude are required numeric values';
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
    ...visibleReport
  } = report;
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

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',') : ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);
app.use(express.json({ limit: '5mb' }));

module.exports = { app, readStore, writeStore, makeId, createToken, requireAdmin };

app.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Municipal Service Issue Reporter API is running',
    phase: 'backend-start',
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    reportsCount: readStore().reports.length,
    timestamp: new Date().toISOString(),
  });
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

app.get('/api/admin/staff', requireAdmin, (req, res) => {
  const staff = readStore().admins.map(({ id, name, email }) => ({ id, name, email }));
  return res.status(200).json({ staff });
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

app.post('/api/reports', async (req, res) => {
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
        status: req.body.status,
        reportedBy: req.body.reportedBy,
        image: req.body.image,
      });

      return res.status(201).json({
        message: 'Report created successfully',
        report,
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
    status: req.body.status || 'Reported',
    reportedBy: req.body.reportedBy || 'Resident',
    reportedAt: new Date().toISOString(),
    image: req.body.image || undefined,
  };

  store.reports.unshift(newReport);
  writeStore(store);

  return res.status(201).json({
    message: 'Report created successfully',
    report: newReport,
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
        const assignee = readStore().admins.find((entry) => entry.id === payload.assignedStaffId);
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

app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required' });
  }

  const store = readStore();
  const existingUser = store.users.find((user) => user.email.toLowerCase() === email.toLowerCase());

  if (existingUser) {
    return res.status(409).json({ message: 'User already exists' });
  }

  const user = {
    id: makeId('USR'),
    name,
    email,
    password: hashPassword(password),
    createdAt: new Date().toISOString(),
  };

  store.users.push(user);
  writeStore(store);

  const token = createToken({ id: user.id, email: user.email, role: 'resident' });

  return res.status(201).json({
    message: 'Resident registered successfully',
    user: { id: user.id, name: user.name, email: user.email },
    token,
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const store = readStore();
  const user = store.users.find(
    (record) => record.email.toLowerCase() === email.toLowerCase() && verifyPassword(password, record.password),
  );

  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  if (!String(user.password).startsWith('scrypt:')) {
    user.password = hashPassword(password);
    writeStore(store);
  }

  const token = createToken({ id: user.id, email: user.email, role: 'resident' });

  return res.status(200).json({
    message: 'Resident login successful',
    user: { id: user.id, name: user.name, email: user.email },
    token,
  });
});

app.post('/api/admin/register', (req, res) => {
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

  const store = readStore();
  const existingAdmin = store.admins.find((admin) => admin.email.toLowerCase() === email.toLowerCase());

  if (existingAdmin) {
    return res.status(409).json({ message: 'Admin already exists' });
  }

  const admin = {
    id: makeId('ADM'),
    name,
    email,
    password: hashPassword(password),
    createdAt: new Date().toISOString(),
  };

  store.admins.push(admin);
  writeStore(store);

  const token = createToken({ id: admin.id, email: admin.email, role: 'admin' });

  return res.status(201).json({
    message: 'Admin registered successfully',
    admin: { id: admin.id, name: admin.name, email: admin.email },
    token,
  });
});

app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const store = readStore();
  const admin = store.admins.find(
    (record) => record.email.toLowerCase() === email.toLowerCase() && verifyPassword(password, record.password),
  );

  if (!admin) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  if (!String(admin.password).startsWith('scrypt:')) {
    admin.password = hashPassword(password);
    writeStore(store);
  }

  const token = createToken({ id: admin.id, email: admin.email, role: 'admin' });

  return res.status(200).json({
    message: 'Admin login successful',
    admin: { id: admin.id, name: admin.name, email: admin.email },
    token,
  });
});

app.use((error, req, res, next) => {
  console.error('Unhandled server error:', error);
  res.status(500).json({ message: 'Internal server error' });
});

if (require.main === module) {
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
      app.listen(PORT, () => {
        console.log(`Municipal Service Server listening on port ${PORT}`);
        console.log(`Store path: ${STORE_PATH}`);
      });
    });
}
