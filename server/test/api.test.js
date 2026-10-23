const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { test, beforeEach, afterEach, after } = require('node:test');
const jwt = require('jsonwebtoken');

process.env.USE_FILE_STORE = 'true';
process.env.NODE_ENV = 'test';
process.env.ADMIN_REGISTRATION_KEYS = 'staff-invite-test-key,second-staff-invite-test-key';
process.env.SUPER_ADMIN_BOOTSTRAP_TOKEN = 'bootstrap-test-only-token';
const testStoreDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'municipal-service-api-test-'));
process.env.DATA_STORE_PATH = path.join(testStoreDirectory, 'store.json');
const assert = require('node:assert/strict');
const {
  getStaffByIdFromDb,
  selectMigrationFiles,
  validateMigrationOptIns,
} = require('../db');

const { app, readStore, writeStore, createToken, parseClientOrigins } = require('../index.js');
app.set('trust proxy', 1);
const staffAuthorization = `Bearer ${createToken({
  id: 'staff-1', email: 'staff@example.test', role: 'staff', municipalityId: 'ZA-MOCK', accessCodeVersion: 1,
})}`;
const superAdminAuthorization = `Bearer ${createToken({ id: 'super-1', email: 'super@example.test', role: 'super_admin' })}`;
const residentAuthorization = `Bearer ${createToken({ id: 'resident-1', name: 'Test Resident', email: 'fixture-resident@example.test', role: 'resident' })}`;
const testMunicipality = {
  id: 'ZA-MOCK', code: 'ZA-MOCK', name: 'Test Municipality', province: 'Gauteng', type: 'B',
  boundarySource: 'Test fixture', boundaryDataset: 'Test fixture', accessCodeHash: 'scrypt:fixture:hash',
  accessCodeVersion: 1, active: true,
};
let requestSequence = 0;

function writeTestStore(reports = [], { users = [], admins = [] } = {}) {
  writeStore({
    reports,
    users: [{ id: 'resident-1', name: 'Test Resident', email: 'fixture-resident@example.test', password: 'scrypt:fixture:hash' }, ...users],
    admins: [
      { id: 'staff-1', name: 'Operations Staff', email: 'staff@example.test', password: 'scrypt:fixture:hash', role: 'staff' },
      { id: 'super-1', name: 'Test Super Admin', email: 'super@example.test', password: 'scrypt:fixture:hash', role: 'super_admin' },
      ...admins,
    ],
    municipalities: [{ ...testMunicipality }],
    staffMunicipalities: [{ staffId: 'staff-1', municipalityId: 'ZA-MOCK', createdAt: new Date().toISOString() }],
    auditLogs: [],
    chatConversations: [],
    aiAssistantConversations: [],
  });
}

function resetStore() {
  writeTestStore();
}

function mockMainApiResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function createMainApiFetch() {
  return async (url, options) => {
    const route = new URL(url).pathname;
    const bearer = options.headers.authorization;
    const cookie = options.headers.cookie?.match(/(?:^|;\s*)msr_session=([^;]+)/)?.[1];
    const token = bearer?.replace(/^Bearer\s+/i, '') || cookie;
    let claims = null;
    if (token) {
      try {
        claims = jwt.verify(token, process.env.JWT_SECRET || 'test-only-secret');
      } catch {
        claims = null;
      }
    }

    if (route === '/api/auth/session') {
      const store = readStore();
      const account = claims?.role === 'resident'
        ? store.users.find((user) => user.id === claims.id && user.email === claims.email)
        : store.admins.find((admin) => admin.id === claims?.id);
      if (!account || account.isActive === false || account.active === false) {
        return mockMainApiResponse(200, { user: null });
      }
      const role = claims.role === 'resident'
        ? 'resident'
        : account.role === 'super_admin' ? 'super_admin' : 'staff';
      return mockMainApiResponse(200, {
        user: { id: account.id, name: account.name, email: account.email, role },
      });
    }

    if (route === '/api/my/reports' && claims?.role === 'resident') {
      const reports = readStore().reports
        .filter((report) => report.residentId === claims.id)
        .map(({ staffNotes, verifiedBy, assignedStaffId, assignedStaffName, department,
          maintenanceTeam, residentId, reportedBy, residentUpdates, ...report }) => ({
          ...report,
          ...(Array.isArray(residentUpdates) ? {
            residentUpdates: residentUpdates.map(({ authorId, ...update }) => update),
          } : {}),
        }));
      return mockMainApiResponse(200, { reports });
    }

    return mockMainApiResponse(404, { message: 'Not found' });
  };
}

function hashTestCode(code) {
  const salt = 'test-code-salt';
  return `scrypt:${salt}:${crypto.scryptSync(code, salt, 64).toString('hex')}`;
}

test('PostgreSQL staff lookup selects one staff member by ID without credentials', async () => {
  let queryText = '';
  let queryParams = [];
  const staff = await getStaffByIdFromDb('staff-1', {
    query: async (text, params) => {
      queryText = text;
      queryParams = params;
      return { rows: [{ id: 'staff-1', name: 'Operations Staff', email: 'staff@example.test', role: 'staff', isActive: true }] };
    },
  });

  assert.match(queryText, /FROM staff_users WHERE id = \$1/i);
  assert.doesNotMatch(queryText, /password_hash/i);
  assert.deepEqual(queryParams, ['staff-1']);
  assert.deepEqual(staff, { id: 'staff-1', name: 'Operations Staff', email: 'staff@example.test', role: 'staff', isActive: true });
});

test('pending AI migration is deferred unless explicitly enabled', () => {
  const migrationFiles = [
    '001_public_pilot_auth_ownership.sql',
    '002_municipality_scoping.sql',
    '003_support_chat.sql',
    '004_ai_assistant.sql',
  ];
  const appliedVersions = new Set(['001_public_pilot_auth_ownership.sql', '002_municipality_scoping.sql']);
  const environment = {
    ENABLE_SUPPORT_CHAT_MIGRATION: 'false',
    ENABLE_AI_ASSISTANT_MIGRATION: 'false',
  };

  const deferred = selectMigrationFiles(migrationFiles, appliedVersions, environment);
  assert.equal(deferred.aiAssistantMigrationDeferred, true);
  assert.deepEqual(deferred.migrationFiles, [
    '001_public_pilot_auth_ownership.sql',
    '002_municipality_scoping.sql',
  ]);
  assert.doesNotThrow(() => validateMigrationOptIns(deferred.migrationFiles, appliedVersions, environment));

  const enabled = selectMigrationFiles(migrationFiles, appliedVersions, {
    ...environment,
    ENABLE_AI_ASSISTANT_MIGRATION: 'true',
  });
  assert.equal(enabled.aiAssistantMigrationDeferred, false);
  assert.ok(enabled.migrationFiles.includes('004_ai_assistant.sql'));
  assert.doesNotThrow(() => validateMigrationOptIns(enabled.migrationFiles, appliedVersions, {
    ...environment,
    ENABLE_AI_ASSISTANT_MIGRATION: 'true',
  }));
});

test('pending non-AI migrations still require explicit opt-in', () => {
  const appliedVersions = new Set(['001_public_pilot_auth_ownership.sql']);
  const environment = {
    ENABLE_MUNICIPALITY_SCOPING_MIGRATION: 'false',
    ENABLE_AI_ASSISTANT_MIGRATION: 'false',
  };
  const selected = selectMigrationFiles([
    '002_municipality_scoping.sql',
    '004_ai_assistant.sql',
  ], appliedVersions, environment);

  assert.equal(selected.aiAssistantMigrationDeferred, true);
  assert.ok(selected.migrationFiles.includes('002_municipality_scoping.sql'));
  assert.throws(
    () => validateMigrationOptIns(selected.migrationFiles, appliedVersions, environment),
    /002_municipality_scoping\.sql is pending/,
  );
});

beforeEach(() => {
  resetStore();
  app.locals.mainApiBaseUrl = 'http://main-api.test';
  app.locals.mainApiFetch = createMainApiFetch();
  app.locals.locationResolver = async (latitude, longitude) => ({
    latitude,
    longitude,
    address: 'Test address',
    city: 'Test City',
    municipality: testMunicipality.name,
    municipalityId: testMunicipality.id,
    province: testMunicipality.province,
    municipalityType: testMunicipality.type,
    boundarySource: testMunicipality.boundarySource,
    boundaryDataset: testMunicipality.boundaryDataset,
    geocodingAttribution: 'Test attribution',
  });
  app.locals.municipalityLister = async () => [{
    ...testMunicipality,
    accessCodeHash: undefined,
    accessCodeVersion: undefined,
  }];
});

afterEach(() => {
  delete app.locals.assistantProvider;
  delete app.locals.assistantTurnAppender;
  delete app.locals.aiAssistantSchemaReady;
  delete app.locals.mainApiBaseUrl;
  delete app.locals.mainApiFetch;
  delete app.locals.mainApiTimeoutMs;
  delete app.locals.mainApiSessionVerifier;
  delete app.locals.mainApiResidentReportLister;
  delete app.locals.municipalitySaver;
  delete app.locals.reportCreator;
  resetStore();
});

after(() => {
  fs.rmSync(testStoreDirectory, { recursive: true, force: true });
});

async function request(path, options = {}) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      ...options,
      headers: {
        'X-Forwarded-For': `192.0.2.${(requestSequence++ % 200) + 1}`,
        ...(options.headers || {}),
      },
    });

    const body = await response.text();
    return {
      status: response.status,
      body: body ? JSON.parse(body) : null,
      headers: response.headers,
    };
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

test('CORS allows local frontend origins in non-production and rejects unapproved origins', async () => {
  for (const origin of ['http://localhost:3000', 'http://127.0.0.1:3000']) {
    const response = await request('/api/health', { headers: { Origin: origin } });
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  }

  const unapproved = await request('/api/health', { headers: { Origin: 'https://unapproved.invalid' } });
  assert.equal(unapproved.headers.get('access-control-allow-origin'), null);
});

test('production client origins are exact trusted HTTPS origins', () => {
  assert.deepEqual(
    parseClientOrigins('https://client.example, https://preview.example/', true),
    ['https://client.example', 'https://preview.example'],
  );
  assert.throws(() => parseClientOrigins('', true), /at least one trusted HTTPS frontend origin/);
  assert.throws(() => parseClientOrigins('http://client.example', true), /production origins must use HTTPS/);
  assert.throws(() => parseClientOrigins('https://client.example/path', true), /exact origins/);
  assert.throws(() => parseClientOrigins('https://user:pass@client.example', true), /exact origins/);
});

test('cookie-authenticated writes accept an allowed Origin and reject untrusted or missing Origin', async () => {
  const token = createToken({
    id: 'resident-1',
    name: 'Test Resident',
    email: 'fixture-resident@example.test',
    role: 'resident',
  });
  const cookie = `msr_session=${token}`;
  const trusted = await request('/api/auth/logout', {
    method: 'POST',
    headers: { Cookie: cookie, Origin: 'http://localhost:3000' },
  });
  assert.equal(trusted.status, 200);

  const reportPayload = {
    title: 'Trusted origin submission',
    description: 'A report from the configured frontend origin.',
    category: 'Pothole',
    location: { latitude: -25.7, longitude: 28.2 },
    priority: 'High',
  };
  const trustedReport = await request('/api/reports', {
    method: 'POST',
    headers: {
      Cookie: cookie,
      Origin: 'http://localhost:3000',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(reportPayload),
  });
  assert.equal(trustedReport.status, 201);

  const untrusted = await request('/api/auth/logout', {
    method: 'POST',
    headers: { Cookie: cookie, Origin: 'https://unapproved.invalid' },
  });
  assert.equal(untrusted.status, 403);
  assert.equal(untrusted.body.message, 'A valid same-origin request is required');

  const missingOrigin = await request('/api/auth/logout', {
    method: 'POST',
    headers: { Cookie: cookie },
  });
  assert.equal(missingOrigin.status, 403);
  assert.equal(missingOrigin.body.message, 'A valid same-origin request is required');

  const untrustedReport = await request('/api/reports', {
    method: 'POST',
    headers: {
      Cookie: cookie,
      Origin: 'https://unapproved.invalid',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(reportPayload),
  });
  assert.equal(untrustedReport.status, 403);
  assert.equal(readStore().reports.length, 1);
});

test('health endpoint reports zero reports at startup', async () => {
  const store = readStore();
  assert.equal(store.reports.length, 0);

  const response = await request('/api/health');
  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ok');
  assert.equal(response.body.reportsCount, 0);
});

test('super-admin municipality directory counts file-store reports by municipality', async () => {
  const store = readStore();
  store.municipalities.push(
    { id: 'TSH', code: 'TSH', name: 'City of Tshwane', province: 'Gauteng', type: 'A', active: true },
    { id: 'MP313', code: 'MP313', name: 'Steve Tshwete', province: 'Mpumalanga', type: 'B', active: true },
  );
  store.reports.push(
    { id: 'tshwane-report', municipalityId: 'TSH', location: { municipalityId: 'TSH' } },
    { id: 'steve-tshwete-report', location: { municipalityId: 'MP313' } },
  );
  store.staffMunicipalities.push({ staffId: 'staff-1', municipalityId: 'TSH' });
  writeStore(store);

  const response = await request('/api/admin/municipalities', { headers: { Authorization: superAdminAuthorization } });
  assert.equal(response.status, 200);
  const municipalities = new Map(response.body.municipalities.map((municipality) => [municipality.id, municipality]));
  assert.equal(municipalities.get('TSH').reportCount, 1);
  assert.equal(municipalities.get('MP313').reportCount, 1);
  assert.equal(municipalities.get('TSH').staffCount, 1);
});

test('super-admin bootstrap is token-gated and can only complete once', async () => {
  writeStore({ reports: [], users: [], admins: [], municipalities: [], staffMunicipalities: [], auditLogs: [] });
  const payload = {
    name: 'Initial Administrator',
    email: 'initial-admin@example.test',
    password: 'initial-admin-strong-password',
    bootstrapToken: process.env.SUPER_ADMIN_BOOTSTRAP_TOKEN,
  };
  const invalid = await request('/api/admin/bootstrap', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, bootstrapToken: 'invalid-token' }),
  });
  assert.equal(invalid.status, 403);

  const created = await request('/api/admin/bootstrap', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.user.role, 'super_admin');
  assert.ok(created.headers.get('set-cookie')?.includes('HttpOnly'));
  assert.ok(/^scrypt:/.test(readStore().admins[0].password));

  const repeated = await request('/api/admin/bootstrap', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  assert.equal(repeated.status, 409);
});

test('staff municipality assignment and account deactivation are super-admin-only', async () => {
  writeStore({ reports: [], users: [], admins: [], municipalities: [], staffMunicipalities: [], auditLogs: [] });
  const bootstrap = await request('/api/admin/bootstrap', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Initial Administrator', email: 'initial-admin@example.test',
      password: 'initial-admin-strong-password', bootstrapToken: process.env.SUPER_ADMIN_BOOTSTRAP_TOKEN,
    }),
  });
  const superCookie = bootstrap.headers.get('set-cookie').split(';', 1)[0];
  const directory = await request('/api/admin/municipalities', { headers: { Cookie: superCookie } });
  assert.equal(directory.status, 200);
  assert.equal(Object.hasOwn(directory.body.municipalities[0], 'accessCodeHash'), false);

  const registered = await request('/api/admin/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Assigned Staff', email: 'assigned-staff@example.test',
      password: 'assigned-staff-strong-password', registrationKey: 'staff-invite-test-key',
    }),
  });
  assert.equal(registered.status, 201);
  const staffId = registered.body.admin.id;
  const staffCookie = registered.headers.get('set-cookie').split(';', 1)[0];
  const municipalityId = directory.body.municipalities[0].id;

  const forbiddenAssignment = await request(`/api/admin/staff/${staffId}/municipalities/${municipalityId}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: staffCookie },
  });
  assert.equal(forbiddenAssignment.status, 403);
  const assigned = await request(`/api/admin/staff/${staffId}/municipalities/${municipalityId}`, {
    method: 'POST', headers: { Cookie: superCookie, Origin: 'http://localhost:3000' },
  });
  assert.equal(assigned.status, 200);

  const staffMunicipalities = await request('/api/staff/municipalities', { headers: { Cookie: staffCookie } });
  assert.equal(staffMunicipalities.status, 200);
  assert.deepEqual(staffMunicipalities.body.municipalities.map((item) => item.id), [municipalityId]);
  assert.equal(Object.hasOwn(staffMunicipalities.body.municipalities[0], 'accessCodeHash'), false);

  const deactivated = await request(`/api/admin/staff/${staffId}/active`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: superCookie, Origin: 'http://localhost:3000' },
    body: JSON.stringify({ active: false }),
  });
  assert.equal(deactivated.status, 200);
  const inactiveSession = await request('/api/staff/municipalities', { headers: { Cookie: staffCookie } });
  assert.equal(inactiveSession.status, 401);
});

test('municipality access checks assignment before code and reset revokes active scope', async () => {
  const customCode = 'saved-municipality-code';
  const store = readStore();
  store.reports.push({
    id: 'scoped-report', title: 'Scoped report', description: 'A report in the assigned municipality',
    category: 'Pothole', location: { latitude: -25.7, longitude: 28.2, municipality: testMunicipality.name },
    municipalityId: testMunicipality.id, priority: 'Medium', status: 'Reported', reportedBy: 'Resident',
  });
  store.admins.push({ id: 'staff-2', name: 'Unassigned Staff', email: 'unassigned@example.test', password: 'scrypt:fixture:hash', role: 'staff' });
  writeStore(store);

  const saved = await request(`/api/admin/municipalities/${testMunicipality.id}/access-code`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: superAdminAuthorization },
    body: JSON.stringify({ accessCode: customCode }),
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.accessCode, undefined);
  assert.match(readStore().municipalities[0].accessCodeHash, /^scrypt:/);
  assert.notEqual(readStore().municipalities[0].accessCodeHash, customCode);

  const invalid = await request(`/api/admin/municipalities/${testMunicipality.id}/access-code`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: superAdminAuthorization },
    body: JSON.stringify({ accessCode: 'short' }),
  });
  assert.equal(invalid.status, 400);

  const unassignedToken = createToken({ id: 'staff-2', email: 'unassigned@example.test', role: 'staff' });
  const unassigned = await request(`/api/staff/municipalities/${testMunicipality.id}/verify-access`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${unassignedToken}` },
    body: JSON.stringify({ accessCode: customCode }),
  });
  assert.equal(unassigned.status, 403);

  const incorrect = await request(`/api/staff/municipalities/${testMunicipality.id}/verify-access`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: staffAuthorization },
    body: JSON.stringify({ accessCode: 'wrong-code' }),
  });
  assert.equal(incorrect.status, 401);

  const verified = await request(`/api/staff/municipalities/${testMunicipality.id}/verify-access`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: staffAuthorization },
    body: JSON.stringify({ accessCode: customCode }),
  });
  assert.equal(verified.status, 200);
  assert.equal(Object.hasOwn(verified.body.municipality, 'accessCodeHash'), false);
  const scopedCookie = verified.headers.get('set-cookie').split(';', 1)[0];
  const scopedReports = await request('/api/admin/reports', { headers: { Cookie: scopedCookie } });
  assert.equal(scopedReports.status, 200);
  assert.deepEqual(scopedReports.body.reports.map((report) => report.id), ['scoped-report']);

  const replacementCode = 'replacement-municipality-code';
  const reset = await request(`/api/admin/municipalities/${testMunicipality.id}/access-code`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: superAdminAuthorization },
    body: JSON.stringify({ accessCode: replacementCode }),
  });
  assert.equal(reset.status, 200);
  assert.equal(reset.body.accessCode, undefined);
  assert.notEqual(readStore().municipalities[0].accessCodeHash, replacementCode);
  const revoked = await request('/api/admin/reports', { headers: { Cookie: scopedCookie } });
  assert.equal(revoked.status, 403);
});

test('staff cannot read or mutate another municipality report or use super-admin functions', async () => {
  const store = readStore();
  store.municipalities.push({
    ...testMunicipality,
    id: 'ZA-OTHER',
    code: 'ZA-OTHER',
    name: 'Other Municipality',
    accessCodeHash: hashTestCode('other-code'),
  });
  store.reports.push({
    id: 'other-municipality-report', title: 'Private other-municipality report',
    description: 'Must not leak through URL access.', category: 'Pothole',
    municipalityId: 'ZA-OTHER', location: { latitude: -26.2, longitude: 28.0 },
    priority: 'High', status: 'Reported', reportedBy: 'Resident',
  });
  writeStore(store);

  const detail = await request('/api/admin/reports/other-municipality-report', { headers: { Authorization: staffAuthorization } });
  assert.equal(detail.status, 403);
  const publicAdminDetail = await request('/api/reports/other-municipality-report', { headers: { Authorization: staffAuthorization } });
  assert.equal(publicAdminDetail.status, 200);

  const status = await request('/api/reports/other-municipality-report/status', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: staffAuthorization },
    body: JSON.stringify({ status: 'In Progress' }),
  });
  assert.equal(status.status, 403);

  const triage = await request('/api/reports/other-municipality-report/triage', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: staffAuthorization },
    body: JSON.stringify({ verified: true }),
  });
  assert.equal(triage.status, 403);

  const note = await request('/api/reports/other-municipality-report/notes', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: staffAuthorization },
    body: JSON.stringify({ text: 'Unauthorized note' }),
  });
  assert.equal(note.status, 403);

  const staffDirectory = await request('/api/admin/staff', { headers: { Authorization: staffAuthorization } });
  assert.equal(staffDirectory.status, 403);
  const codeManagement = await request('/api/admin/municipalities/ZA-OTHER/access-code', {
    method: 'POST', headers: { Authorization: staffAuthorization },
  });
  assert.equal(codeManagement.status, 403);
});

test('staff registration requires the configured invite key and stores a password hash', async () => {
  const payload = { name: 'Test Staff', email: 'new-staff@example.test', password: 'strong-test-password' };
  const denied = await request('/api/admin/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  assert.equal(denied.status, 403);

  const invalidKey = await request('/api/admin/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, registrationKey: 'not-a-configured-invite' }),
  });
  assert.equal(invalidKey.status, 403);

  const registered = [];
  for (const [index, registrationKey] of process.env.ADMIN_REGISTRATION_KEYS.split(',').entries()) {
    registered.push(await request('/api/admin/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, email: `staff-${index}@example.test`, registrationKey }),
    }));
  }
  assert.deepEqual(registered.map((response) => response.status), [201, 201]);
  assert.ok(registered.every((response) => response.headers.get('set-cookie')?.includes('HttpOnly')));
  assert.ok(registered.every((response) => !response.body.token));
  assert.equal(registered[0].body.admin.role, 'staff');
  assert.ok(readStore().admins.every((admin) => /^scrypt:/.test(admin.password)));

  const staffCookie = registered[0].headers.get('set-cookie').split(';', 1)[0];
  const staffReports = await request('/api/admin/reports', {
    headers: { Cookie: staffCookie },
  });
  assert.equal(staffReports.status, 403);

  const login = await request('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'staff-0@example.test', password: payload.password }),
  });
  assert.equal(login.status, 200);
  assert.ok(login.headers.get('set-cookie')?.includes('HttpOnly'));
  assert.equal(login.body.token, undefined);
});

test('resident accounts use hashed passwords and cookie-based sessions', async () => {
  const account = {
    name: 'Test Resident',
    email: 'resident@example.test',
    password: 'resident-test-password',
    phone: '5550100',
  };
  const registration = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(account),
  });

  assert.equal(registration.status, 201);
  assert.ok(registration.headers.get('set-cookie')?.includes('HttpOnly'));
  assert.equal(registration.body.token, undefined);
  assert.ok(/^scrypt:/.test(readStore().users[0].password));

  const sessionCookie = registration.headers.get('set-cookie').split(';', 1)[0];
  const session = await request('/api/auth/session', { headers: { Cookie: sessionCookie } });
  assert.equal(session.status, 200);
  assert.equal(session.body.user.role, 'resident');
  assert.equal(session.body.user.email, account.email);

  const createdReport = await request('/api/reports', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionCookie,
      Origin: 'http://localhost:3000',
    },
    body: JSON.stringify({
      title: 'Resident-owned report',
      description: 'A test report attached to the authenticated resident.',
      category: 'Pothole',
      location: { latitude: -25.7, longitude: 28.2, city: 'Pretoria', municipality: 'City of Tshwane' },
      reportedBy: 'Spoofed client name',
      residentId: 'spoofed-owner',
    }),
  });
  assert.equal(createdReport.status, 201);
  assert.equal(createdReport.body.report.location.municipality, testMunicipality.name);
  assert.equal(createdReport.body.report.location.municipalityId, testMunicipality.id);
  assert.equal(createdReport.body.report.municipalityId, testMunicipality.id);
  assert.equal(createdReport.body.report.reportedBy, undefined);
  assert.equal(Object.hasOwn(createdReport.body.report, 'residentId'), false);

  const secondRegistration = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Second Resident',
      email: 'second-resident@example.test',
      password: 'second-resident-password',
    }),
  });
  assert.equal(secondRegistration.status, 201);
  const secondCookie = secondRegistration.headers.get('set-cookie').split(';', 1)[0];
  const secondReport = await request('/api/reports', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: secondCookie,
      Origin: 'http://localhost:3000',
    },
    body: JSON.stringify({
      title: 'Second resident report',
      description: 'This report must not appear in another resident account.',
      category: 'Water Leak',
      location: { latitude: -26.2, longitude: 28.0, city: 'Johannesburg', municipality: 'City of Johannesburg' },
    }),
  });
  assert.equal(secondReport.status, 201);

  const ownReports = await request('/api/my/reports', { headers: { Cookie: sessionCookie } });
  assert.equal(ownReports.status, 200);
  assert.equal(ownReports.body.reports.length, 1);
  assert.equal(ownReports.body.reports[0].title, 'Resident-owned report');

  const publicReports = await request('/api/reports');
  const publicResidentReport = publicReports.body.reports.find((report) => report.title === 'Resident-owned report');
  assert.equal(publicResidentReport.reportedBy, undefined);
  assert.equal(Object.hasOwn(publicResidentReport, 'residentId'), false);

  const crossOriginMutation = await request('/api/auth/logout', {
    method: 'POST',
    headers: { Cookie: sessionCookie, Origin: 'https://attacker.example' },
  });
  assert.equal(crossOriginMutation.status, 403);

  const duplicate = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(account),
  });
  assert.equal(duplicate.status, 409);

  const logout = await request('/api/auth/logout', {
    method: 'POST',
    headers: { Cookie: sessionCookie, Origin: 'http://localhost:3000' },
  });
  assert.equal(logout.status, 200);
  assert.ok(logout.headers.get('set-cookie')?.startsWith('msr_session=;'));
});

test('report submission rejects coordinates without an authoritative municipality match', async () => {
  app.locals.locationResolver = async () => null;
  const response = await request('/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: residentAuthorization },
    body: JSON.stringify({
      title: 'Unresolved location',
      description: 'This report must not be created without a boundary match.',
      category: 'Pothole',
      location: { latitude: -25.7, longitude: 28.2, municipality: 'Forged Municipality', municipalityId: 'FORGED' },
    }),
  });
  assert.equal(response.status, 422);
  assert.equal(readStore().reports.length, 0);
});

test('location lookup returns only authoritative municipality data and reports provider outages safely', async () => {
  const payload = { latitude: -25.7, longitude: 28.2 };
  const resolved = await request('/api/location/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: residentAuthorization },
    body: JSON.stringify(payload),
  });
  assert.equal(resolved.status, 200);
  assert.equal(resolved.body.location.latitude, payload.latitude);
  assert.equal(resolved.body.location.longitude, payload.longitude);
  assert.equal(resolved.body.location.municipality, testMunicipality.name);
  assert.equal(resolved.body.location.address, 'Test address');

  app.locals.locationResolver = async () => {
    throw new Error('private geocoder endpoint details');
  };
  let loggedError;
  const originalConsoleError = console.error;
  console.error = (...args) => { loggedError = args; };
  let unavailable;
  try {
    unavailable = await request('/api/location/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: residentAuthorization },
      body: JSON.stringify(payload),
    });
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.body.message, 'Location services are temporarily unavailable. Please try again.');
  assert.doesNotMatch(JSON.stringify(loggedError), /private geocoder endpoint details/);
});

test('categories endpoint returns the issue taxonomy', async () => {
  const response = await request('/api/categories');
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body.categories));
  assert.ok(response.body.categories.includes('Pothole'));
  assert.ok(response.body.categories.includes('Blocked Drain'));
});

test('report lifecycle creates and removes a report without leaving seeded data behind', async () => {
  const payload = {
    title: 'Test Drain Issue',
    description: 'Testing the API route',
    category: 'Blocked Drain',
    location: {
      latitude: -26.2041,
      longitude: 28.0473,
      city: 'Johannesburg',
      municipality: 'City of Johannesburg',
    },
    priority: 'High',
    status: 'Resolved',
    reportedBy: 'Resident',
    image: '',
  };

  const anonymousCreate = await request('/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  assert.equal(anonymousCreate.status, 401);

  const createResponse = await request('/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: residentAuthorization },
    body: JSON.stringify({ ...payload, reportedBy: 'Spoofed Name', residentId: 'spoofed-owner' }),
  });

  assert.equal(createResponse.status, 201);
  assert.equal(createResponse.body.report.title, payload.title);
  assert.equal(createResponse.body.report.status, 'Reported');
  assert.equal(createResponse.body.report.location.latitude, payload.location.latitude);
  assert.equal(createResponse.body.report.location.longitude, payload.location.longitude);
  assert.equal(createResponse.body.report.location.address, 'Test address');
  assert.equal(createResponse.body.report.location.municipality, testMunicipality.name);
  assert.equal(createResponse.body.report.priority, payload.priority);
  assert.equal(createResponse.body.report.category, payload.category);
  assert.equal(createResponse.body.report.reportedBy, undefined);
  assert.equal(createResponse.body.report.residentId, undefined);
  assert.equal(readStore().reports[0].residentId, 'resident-1');

  const privateReports = await request('/api/my/reports', {
    headers: { Authorization: residentAuthorization },
  });
  assert.equal(privateReports.status, 200);
  assert.equal(privateReports.body.reports.length, 1);
  assert.equal(privateReports.body.reports[0].title, payload.title);

  const anonymousPrivateReports = await request('/api/my/reports');
  assert.equal(anonymousPrivateReports.status, 401);

  const listResponse = await request('/api/reports');
  assert.equal(listResponse.status, 200);
  assert.ok(Array.isArray(listResponse.body.reports));
  assert.equal(listResponse.body.reports.length, 1);

  const reportId = createResponse.body.report.id;
  const deleteResponse = await request(`/api/reports/${reportId}`, {
    method: 'DELETE',
    headers: { Authorization: superAdminAuthorization },
  });
  assert.equal(deleteResponse.status, 200);

  const finalList = await request('/api/reports');
  assert.equal(finalList.status, 200);
  assert.equal(finalList.body.reports.length, 0);

  resetStore();
});

test('evidence uploads reject unapproved formats and images over the size limit', async () => {
  const payload = {
    title: 'Image validation test',
    description: 'The API must validate user uploads.',
    category: 'Pothole',
    location: { latitude: -25.7, longitude: 28.2, city: 'Pretoria', municipality: 'City of Tshwane' },
  };

  const unsupported = await request('/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: residentAuthorization },
    body: JSON.stringify({ ...payload, image: 'data:image/svg+xml;base64,PHN2Zz4=' }),
  });
  assert.equal(unsupported.status, 400);

  const oversized = await request('/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: residentAuthorization },
    body: JSON.stringify({ ...payload, image: `data:image/png;base64,${'A'.repeat(4_200_001)}` }),
  });
  assert.equal(oversized.status, 400);

  const mismatchedBytes = await request('/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: residentAuthorization },
    body: JSON.stringify({ ...payload, image: 'data:image/png;base64,SGVsbG8=' }),
  });
  assert.equal(mismatchedBytes.status, 400);

  const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+nQioAAAAASUVORK5CYII=';
  const accepted = await request('/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: residentAuthorization },
    body: JSON.stringify({ ...payload, image: validPng }),
  });
  assert.equal(accepted.status, 201);
  assert.equal(readStore().reports[0].image, validPng);
});

test('report storage failures return a safe service-unavailable response and do not create a report', async () => {
  app.locals.municipalitySaver = async () => testMunicipality;
  app.locals.reportCreator = async () => {
    const error = new Error('sensitive database connection details');
    error.code = '08006';
    throw error;
  };
  const payload = {
    title: 'Storage outage test',
    description: 'This report must not appear saved when storage is unavailable.',
    category: 'Pothole',
    location: { latitude: -25.7, longitude: 28.2 },
    priority: 'Medium',
  };
  let loggedError;
  const originalConsoleError = console.error;
  console.error = (...args) => { loggedError = args; };
  let response;
  try {
    response = await request('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: residentAuthorization },
      body: JSON.stringify(payload),
    });
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(response.status, 503);
  assert.equal(response.body.message, 'Report storage is temporarily unavailable. Please try again.');
  assert.equal(readStore().reports.length, 0);
  assert.doesNotMatch(JSON.stringify(loggedError), /sensitive database connection details/);
});

test('malformed JSON receives a safe client error', async () => {
  const response = await request('/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: residentAuthorization },
    body: '{',
  });
  assert.equal(response.status, 400);
  assert.equal(response.body.message, 'Request body must be valid JSON.');
});

test('oversized JSON receives HTTP 413 with a safe response', async () => {
  const response = await request('/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ padding: 'x'.repeat(5 * 1024 * 1024) }),
  });
  assert.equal(response.status, 413);
  assert.equal(response.body.message, 'Request body exceeds the allowed size.');
});

test('resident reports reject invalid categories and coordinates outside South Africa', async () => {
  const payload = {
    title: 'Location validation test',
    description: 'The API rejects locations outside the service area.',
    category: 'Pothole',
    location: { latitude: -25.7, longitude: 28.2, city: 'Pretoria', municipality: 'City of Tshwane' },
  };

  const invalidCategory = await request('/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: residentAuthorization },
    body: JSON.stringify({ ...payload, category: 'Fake Category' }),
  });
  assert.equal(invalidCategory.status, 400);

  const outsideSouthAfrica = await request('/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: residentAuthorization },
    body: JSON.stringify({ ...payload, location: { ...payload.location, latitude: 40, longitude: -74 } }),
  });
  assert.equal(outsideSouthAfrica.status, 400);
});

test('report submission rejects blank or overlong text and invalid priorities', async () => {
  const payload = {
    title: 'Road damage',
    description: 'A detailed description of the damaged road.',
    category: 'Pothole',
    location: { latitude: -25.7, longitude: 28.2 },
    priority: 'High',
  };
  const invalidPayloads = [
    { ...payload, title: '   ' },
    { ...payload, title: 'x'.repeat(161) },
    { ...payload, description: '   ' },
    { ...payload, description: 'x'.repeat(5001) },
    { ...payload, priority: 'Urgent' },
  ];

  for (const invalidPayload of invalidPayloads) {
    const response = await request('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: residentAuthorization },
      body: JSON.stringify(invalidPayload),
    });
    assert.equal(response.status, 400);
  }
  assert.equal(readStore().reports.length, 0);
});

test('evidence accepts supported image signatures for JPEG, PNG, and WebP', async () => {
  const payload = {
    title: 'Supported evidence type',
    description: 'The selected image has a supported image signature.',
    category: 'Pothole',
    location: { latitude: -25.7, longitude: 28.2 },
  };
  const images = [
    ['jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xd9])],
    ['png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ['webp', Buffer.from('RIFF\x04\x00\x00\x00WEBP', 'binary')],
  ];

  for (const [type, bytes] of images) {
    const response = await request('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: residentAuthorization },
      body: JSON.stringify({
        ...payload,
        title: `${payload.title} ${type}`,
        image: `data:image/${type};base64,${bytes.toString('base64')}`,
      }),
    });
    assert.equal(response.status, 201, `${type} image should be accepted`);
  }
});

test('reports endpoint supports category and status filters and updates status correctly', async () => {
  const seed = [
    {
      id: 'seed-pothole-1',
      title: 'Pothole on Main Road',
      description: 'Large pothole near the traffic lights',
      category: 'Pothole',
      location: {
        latitude: -25.7479,
        longitude: 28.2293,
        city: 'Pretoria',
        municipality: 'City of Tshwane',
      },
      priority: 'Critical',
      status: 'Reported',
      reportedBy: 'Resident',
      reportedAt: new Date().toISOString(),
    },
    {
      id: 'seed-pipe-2',
      title: 'Water leak in suburb',
      description: 'Burst pipe affecting the area',
      category: 'Burst Pipe',
      location: {
        latitude: -26.2041,
        longitude: 28.0473,
        city: 'Johannesburg',
        municipality: 'City of Johannesburg',
      },
      priority: 'High',
      status: 'In Progress',
      reportedBy: 'Resident',
      reportedAt: new Date().toISOString(),
    },
  ];

  seed[0].municipalityId = testMunicipality.id;
  seed[1].municipalityId = testMunicipality.id;
  writeTestStore(seed);

  const filtered = await request('/api/reports?category=Pothole&status=Reported');
  assert.equal(filtered.status, 200);
  assert.equal(filtered.body.reports.length, 1);
  assert.equal(filtered.body.reports[0].category, 'Pothole');

  const update = await request(`/api/reports/${filtered.body.reports[0].id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: staffAuthorization,
    },
    body: JSON.stringify({ status: 'Resolved' }),
  });

  assert.equal(update.status, 200);
  assert.equal(update.body.report.status, 'Resolved');

  const search = await request('/api/reports?search=burst');
  assert.equal(search.status, 200);
  assert.equal(search.body.reports.length, 1);
  assert.equal(search.body.reports[0].category, 'Burst Pipe');

  const anonymousClear = await request('/api/reports', { method: 'DELETE' });
  assert.equal(anonymousClear.status, 401);
  const residentClear = await request('/api/reports', {
    method: 'DELETE',
    headers: { Authorization: residentAuthorization },
  });
  assert.equal(residentClear.status, 403);
  assert.equal(readStore().reports.length, 2);

  const clearAll = await request('/api/reports', {
    method: 'DELETE',
    headers: { Authorization: superAdminAuthorization },
  });
  assert.equal(clearAll.status, 200);
  assert.equal(clearAll.body.removedCount, 2);

  const finalState = await request('/api/reports');
  assert.equal(finalState.status, 200);
  assert.equal(finalState.body.reports.length, 0);

  resetStore();
});

test('report status changes require a valid staff token and assigned municipality access', async () => {
  writeTestStore([{
      id: 'protected-report',
      title: 'Protected report',
      description: 'A report for auth testing',
      category: 'Pothole',
      location: { latitude: -25.7, longitude: 28.2 },
      priority: 'High',
      status: 'Reported',
      reportedBy: 'Resident',
      municipalityId: testMunicipality.id,
  }]);
  const path = '/api/reports/protected-report/status';
  const body = JSON.stringify({ status: 'Under Review' });

  const anonymous = await request(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  assert.equal(anonymous.status, 401);

  const residentToken = createToken({ id: 'resident-1', email: 'resident@example.test', role: 'resident' });
  const resident = await request(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${residentToken}` },
    body,
  });
  assert.equal(resident.status, 403);

  const staff = await request(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: staffAuthorization },
    body,
  });
  assert.equal(staff.status, 200);
  assert.equal(staff.body.report.status, 'Under Review');
});

test('super admins cannot perform staff report operations and staff directory is municipality-scoped', async () => {
  const report = {
    id: 'primary-report', title: 'Primary pothole', description: 'A pothole', category: 'Pothole',
    location: { latitude: -25.7, longitude: 28.2 }, municipalityId: testMunicipality.id,
    priority: 'Medium', status: 'Reported', reportedBy: 'Resident', residentId: 'resident-1',
    assignedStaffId: 'staff-1', assignedStaffName: 'Operations Staff',
    staffNotes: [{ id: 'note-1', text: 'Private inspection note' }],
  };
  writeTestStore([report], {
    admins: [{ id: 'staff-2', name: 'Unassigned Staff', email: 'unassigned@example.test', role: 'staff' }],
  });

  const superAdminHeaders = { Authorization: superAdminAuthorization, 'Content-Type': 'application/json' };
  const overview = await request('/api/admin/reports?municipalityId=ZA-MOCK', { headers: superAdminHeaders });
  assert.equal(overview.status, 200);
  assert.equal(overview.body.reports.length, 1);
  assert.equal(Object.hasOwn(overview.body.reports[0], 'reportedBy'), false);
  assert.equal(Object.hasOwn(overview.body.reports[0], 'residentId'), false);
  assert.equal(Object.hasOwn(overview.body.reports[0], 'assignedStaffName'), false);
  assert.equal(Object.hasOwn(overview.body.reports[0], 'staffNotes'), false);

  const detail = await request('/api/admin/reports/primary-report', { headers: superAdminHeaders });
  assert.equal(detail.status, 403);

  const status = await request('/api/reports/primary-report/status', {
    method: 'PATCH', headers: superAdminHeaders, body: JSON.stringify({ status: 'In Progress' }),
  });
  assert.equal(status.status, 403);

  const triage = await request('/api/reports/primary-report/triage', {
    method: 'PATCH', headers: superAdminHeaders, body: JSON.stringify({ status: 'Resolved' }),
  });
  assert.equal(triage.status, 403);

  const note = await request('/api/reports/primary-report/notes', {
    method: 'POST', headers: superAdminHeaders, body: JSON.stringify({ text: 'Unauthorized note' }),
  });
  assert.equal(note.status, 403);

  const update = await request('/api/reports/primary-report/updates', {
    method: 'POST', headers: superAdminHeaders,
    body: JSON.stringify({ status: 'In Progress', text: 'Unauthorized update' }),
  });
  assert.equal(update.status, 403);

  const staffHeaders = { Authorization: staffAuthorization };
  const directory = await request('/api/staff/directory', { headers: staffHeaders });
  assert.equal(directory.status, 200);
  assert.deepEqual(directory.body.staff, [{ id: 'staff-1', name: 'Operations Staff', email: 'staff@example.test' }]);

  const savedReport = readStore().reports[0];
  assert.equal(savedReport.status, 'Reported');
  assert.deepEqual(savedReport.staffNotes, [{ id: 'note-1', text: 'Private inspection note' }]);
  assert.equal(savedReport.residentUpdates, undefined);
});

test('staff triage, assignments, notes, updates, and duplicate links persist with correct visibility', async () => {
  const primary = {
    id: 'primary-report', title: 'Primary pothole', description: 'A pothole', category: 'Pothole',
    location: { latitude: -25.7, longitude: 28.2 }, priority: 'Medium', status: 'Reported',
    reportedBy: 'Resident', residentId: 'resident-1',
  };
  const duplicate = {
    ...primary, id: 'duplicate-report', title: 'Nearby pothole',
  };
  primary.municipalityId = testMunicipality.id;
  duplicate.municipalityId = testMunicipality.id;
  writeTestStore([primary, duplicate]);

  const triage = await request('/api/reports/duplicate-report/triage', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: staffAuthorization },
    body: JSON.stringify({
      status: 'Assigned', category: 'Damaged Road', priority: 'Critical', verified: true,
      department: 'Roads', maintenanceTeam: 'North Crew', assignedStaffId: 'staff-1', duplicateOf: 'primary-report',
    }),
  });
  assert.equal(triage.status, 200);
  assert.equal(triage.body.report.status, 'Assigned');
  assert.equal(triage.body.report.category, 'Damaged Road');
  assert.equal(triage.body.report.verified, true);
  assert.equal(triage.body.report.assignedStaffName, 'Operations Staff');
  assert.equal(triage.body.report.duplicateOf, 'primary-report');

  const selfDuplicate = await request('/api/reports/duplicate-report/triage', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: staffAuthorization },
    body: JSON.stringify({ duplicateOf: 'duplicate-report' }),
  });
  assert.equal(selfDuplicate.status, 400);

  const missingDuplicate = await request('/api/reports/duplicate-report/triage', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: staffAuthorization },
    body: JSON.stringify({ duplicateOf: 'missing-report' }),
  });
  assert.equal(missingDuplicate.status, 400);

  const note = await request('/api/reports/duplicate-report/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: staffAuthorization },
    body: JSON.stringify({ text: 'Crew dispatched for inspection.' }),
  });
  assert.equal(note.status, 201);

  const residentUpdate = await request('/api/reports/duplicate-report/updates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: staffAuthorization },
    body: JSON.stringify({ status: 'In Progress', text: 'A maintenance team is attending to this issue.' }),
  });
  assert.equal(residentUpdate.status, 201);
  assert.equal(residentUpdate.body.report.status, 'In Progress');

  const publicReport = await request('/api/reports/duplicate-report');
  assert.equal(publicReport.status, 200);
  assert.equal(Object.hasOwn(publicReport.body.report, 'staffNotes'), false);
  assert.equal(Object.hasOwn(publicReport.body.report, 'assignedStaffName'), false);
  assert.equal(Object.hasOwn(publicReport.body.report, 'department'), false);
  assert.equal(publicReport.body.report.residentUpdates.length, 1);
  assert.equal(publicReport.body.report.residentUpdates[0].text, 'A maintenance team is attending to this issue.');
  assert.equal(Object.hasOwn(publicReport.body.report.residentUpdates[0], 'authorId'), false);

  const residentReport = await request('/api/my/reports', { headers: { Authorization: residentAuthorization } });
  assert.equal(residentReport.status, 200);
  assert.equal(residentReport.body.reports.length, 2);
  assert.equal(Object.hasOwn(residentReport.body.reports[0], 'staffNotes'), false);
  assert.equal(Object.hasOwn(residentReport.body.reports[0], 'assignedStaffName'), false);
  assert.equal(Object.hasOwn(residentReport.body.reports[0], 'reportedBy'), false);

  const publicList = await request('/api/reports');
  const publicDuplicate = publicList.body.reports.find((report) => report.id === 'duplicate-report');
  assert.equal(Object.hasOwn(publicDuplicate, 'staffNotes'), false);
  assert.equal(Object.hasOwn(publicDuplicate.residentUpdates[0], 'authorId'), false);

  const canonicalReport = await request('/api/reports/primary-report');
  assert.equal(canonicalReport.body.report.duplicateReports.length, 1);
  assert.equal(canonicalReport.body.report.duplicateReports[0].id, 'duplicate-report');

  const staffReport = await request('/api/admin/reports/duplicate-report', {
    headers: { Authorization: staffAuthorization },
  });
  assert.equal(staffReport.status, 200);
  assert.equal(staffReport.body.report.staffNotes.length, 1);
  assert.equal(staffReport.body.report.residentUpdates[0].authorId, 'staff-1');

  const staffList = await request('/api/admin/reports', { headers: { Authorization: staffAuthorization } });
  const staffSummary = staffList.body.reports.find((report) => report.id === 'duplicate-report');
  assert.equal(Object.hasOwn(staffSummary, 'staffNotes'), false);
  assert.equal(staffSummary.assignedStaffName, 'Operations Staff');
  assert.equal(staffSummary.department, 'Roads');
});

test('AI assistant requires a resident and retires resident-to-staff chat routes', async () => {
  const anonymous = await request('/api/assistant/conversations');
  assert.equal(anonymous.status, 401);

  const staff = await request('/api/assistant/conversations', {
    headers: { Authorization: staffAuthorization },
  });
  assert.equal(staff.status, 403);

  const retired = await request('/api/chat/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: residentAuthorization },
    body: JSON.stringify({}),
  });
  assert.equal(retired.status, 410);
  const retiredHistory = await request(`/api/chat/conversations/${crypto.randomUUID()}/messages`, {
    headers: { Authorization: staffAuthorization },
  });
  assert.equal(retiredHistory.status, 410);
});

test('AI assistant cookie-authenticated writes reject missing and untrusted origins', async () => {
  const token = residentAuthorization.replace(/^Bearer\s+/i, '');
  const headers = {
    'Content-Type': 'application/json',
    Cookie: `msr_session=${token}`,
  };

  const missingOrigin = await request('/api/assistant/conversations', {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  assert.equal(missingOrigin.status, 403);
  assert.equal(missingOrigin.body.message, 'A valid same-origin request is required');

  const untrustedOrigin = await request('/api/assistant/conversations', {
    method: 'POST',
    headers: { ...headers, Origin: 'https://unapproved.invalid' },
    body: JSON.stringify({}),
  });
  assert.equal(untrustedOrigin.status, 403);
  assert.equal(untrustedOrigin.body.message, 'A valid same-origin request is required');
});

test('AI assistant returns unavailable while its schema is pending without blocking the API', async () => {
  app.locals.aiAssistantSchemaReady = false;
  const headers = {
    Authorization: residentAuthorization,
    'Content-Type': 'application/json',
  };
  const list = await request('/api/assistant/conversations', {
    headers: { Authorization: residentAuthorization },
  });
  assert.equal(list.status, 503);
  assert.equal(list.body.conversations, undefined);

  const created = await request('/api/assistant/conversations', {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  assert.equal(created.status, 503);
  assert.equal(created.body.conversation, undefined);

  const history = await request(`/api/assistant/conversations/${crypto.randomUUID()}/messages`, {
    headers: { Authorization: residentAuthorization },
  });
  assert.equal(history.status, 503);
  assert.equal(history.body.messages, undefined);

  const send = await request(`/api/assistant/conversations/${crypto.randomUUID()}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content: 'Hello' }),
  });
  assert.equal(send.status, 503);
  assert.equal(send.body.messages, undefined);

  const health = await request('/api/health');
  assert.equal(health.status, 200);
});

test('AI assistant validates the forwarded session cookie with the main API', async () => {
  let forwardedCookie;
  const mainApiFetch = createMainApiFetch();
  app.locals.mainApiFetch = async (url, options) => {
    forwardedCookie = options.headers.cookie;
    assert.equal(options.headers.cookie.includes('other=should-not-forward'), false);
    return mainApiFetch(url, options);
  };
  const token = residentAuthorization.replace(/^Bearer\s+/i, '');
  const response = await request('/api/assistant/conversations', {
    headers: { Cookie: `msr_session=${token}; other=should-not-forward` },
  });

  assert.equal(response.status, 200);
  assert.equal(forwardedCookie, `msr_session=${token}`);
  assert.deepEqual(response.body.conversations, []);
});

test('AI assistant fails safely when main API session verification is unavailable', async () => {
  app.locals.mainApiFetch = async () => {
    throw new Error('private upstream details');
  };
  const unavailable = await request('/api/assistant/conversations', {
    headers: { Cookie: 'msr_session=opaque-session' },
  });
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.body.message, 'Unable to verify account access right now.');
  assert.equal(JSON.stringify(unavailable.body).includes('private upstream details'), false);

  app.locals.mainApiFetch = async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    });
  });
  app.locals.mainApiTimeoutMs = 5;
  const timedOut = await request('/api/assistant/conversations', {
    headers: { Cookie: 'msr_session=opaque-session' },
  });
  assert.equal(timedOut.status, 503);
  assert.equal(timedOut.body.message, 'Unable to verify account access right now.');
});

test('production AI authentication requires an explicit HTTPS main API origin', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalMainApiBaseUrl = process.env.MAIN_API_BASE_URL;
  process.env.NODE_ENV = 'production';
  process.env.MAIN_API_BASE_URL = '';

  try {
    app.locals.mainApiBaseUrl = '';
    const missingOrigin = await request('/api/assistant/conversations', {
      headers: { Authorization: residentAuthorization },
    });
    assert.equal(missingOrigin.status, 503);

    app.locals.mainApiBaseUrl = 'http://127.0.0.1:4003';
    const localOrigin = await request('/api/assistant/conversations', {
      headers: { Authorization: residentAuthorization },
    });
    assert.equal(localOrigin.status, 503);

    app.locals.mainApiBaseUrl = 'https://api.example.test';
    const secureOrigin = await request('/api/assistant/conversations', {
      headers: { Authorization: residentAuthorization },
    });
    assert.equal(secureOrigin.status, 200);
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalMainApiBaseUrl === undefined) delete process.env.MAIN_API_BASE_URL;
    else process.env.MAIN_API_BASE_URL = originalMainApiBaseUrl;
  }
});

test('AI conversations persist turns and remain private to their resident', async () => {
  const calls = [];
  app.locals.assistantProvider = async (payload) => {
    calls.push(payload);
    return 'Use the formal report page to submit a new issue.';
  };
  const store = readStore();
  store.users.push({
    id: 'resident-2',
    name: 'Other Resident',
    email: 'other-resident@example.test',
    password: 'scrypt:fixture:hash',
  });
  writeStore(store);
  const otherResidentAuthorization = `Bearer ${createToken({
    id: 'resident-2',
    email: 'other-resident@example.test',
    role: 'resident',
  })}`;

  const created = await request('/api/assistant/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: residentAuthorization },
    body: JSON.stringify({}),
  });
  assert.equal(created.status, 201);
  const conversationId = created.body.conversation.id;

  const emptyMessage = await request(`/api/assistant/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: residentAuthorization },
    body: JSON.stringify({ content: '  ' }),
  });
  assert.equal(emptyMessage.status, 400);

  const oversized = await request(`/api/assistant/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: residentAuthorization },
    body: JSON.stringify({ content: 'x'.repeat(2001) }),
  });
  assert.equal(oversized.status, 400);

  const sent = await request(`/api/assistant/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: residentAuthorization },
    body: JSON.stringify({ content: 'How do I report a pothole?' }),
  });
  assert.equal(sent.status, 201);
  assert.deepEqual(sent.body.messages.map((message) => message.role), ['user', 'assistant']);
  assert.equal(sent.body.messages[1].content, 'Use the formal report page to submit a new issue.');
  assert.deepEqual(calls[0].messages, [{ role: 'user', content: 'How do I report a pothole?' }]);

  const outsiderHistory = await request(`/api/assistant/conversations/${conversationId}/messages`, {
    headers: { Authorization: otherResidentAuthorization },
  });
  assert.equal(outsiderHistory.status, 404);

  const outsiderList = await request('/api/assistant/conversations', {
    headers: { Authorization: otherResidentAuthorization },
  });
  assert.equal(outsiderList.status, 200);
  assert.deepEqual(outsiderList.body.conversations, []);

  const history = await request(`/api/assistant/conversations/${conversationId}/messages`, {
    headers: { Authorization: residentAuthorization },
  });
  assert.equal(history.status, 200);
  assert.deepEqual(history.body.messages.map((message) => message.content), [
    'How do I report a pothole?',
    'Use the formal report page to submit a new issue.',
  ]);
});

test('AI report context contains only verified owner-visible report information', async () => {
  let providerPayload;
  app.locals.assistantProvider = async (payload) => {
    providerPayload = payload;
    return 'Your report is under review.';
  };
  const store = readStore();
  store.reports.push({
    id: 'private-assistant-report',
    title: 'Broken light',
    category: 'Broken Streetlight',
    description: 'Streetlight is out.',
    priority: 'High',
    status: 'Under Review',
    residentId: 'resident-1',
    reportedAt: '2026-10-01T12:00:00.000Z',
    location: { municipality: 'Test Municipality', city: 'Test City' },
    staffNotes: [{ text: 'internal note' }],
    assignedStaffName: 'Private Staff',
    residentUpdates: [{ status: 'Under Review', text: 'Inspection planned.', createdAt: '2026-10-02T12:00:00.000Z' }],
  });
  store.reports.push({
    id: 'another-residents-report',
    title: 'Private report',
    residentId: 'resident-2',
  });
  store.users.push({
    id: 'resident-2',
    name: 'Other Resident',
    email: 'other-resident@example.test',
    password: 'scrypt:fixture:hash',
  });
  writeStore(store);

  const created = await request('/api/assistant/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: residentAuthorization },
    body: JSON.stringify({}),
  });
  const conversationId = created.body.conversation.id;

  const sent = await request(`/api/assistant/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: residentAuthorization },
    body: JSON.stringify({ content: 'What is happening with my report?', reportReference: 'private-assistant-report' }),
  });
  assert.equal(sent.status, 201);
  assert.deepEqual(providerPayload.reportContext, {
    reference: 'private-assistant-report',
    title: 'Broken light',
    category: 'Broken Streetlight',
    description: 'Streetlight is out.',
    priority: 'High',
    status: 'Under Review',
    municipality: 'Test Municipality',
    city: 'Test City',
    reportedAt: '2026-10-01T12:00:00.000Z',
    residentUpdates: [{
      status: 'Under Review',
      text: 'Inspection planned.',
      createdAt: '2026-10-02T12:00:00.000Z',
    }],
  });
  assert.equal(JSON.stringify(providerPayload.reportContext).includes('internal note'), false);
  assert.equal(JSON.stringify(providerPayload.reportContext).includes('Private Staff'), false);

  const otherReportReference = await request(`/api/assistant/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: residentAuthorization },
    body: JSON.stringify({ content: 'What is this report status?', reportReference: 'another-residents-report' }),
  });
  assert.equal(otherReportReference.status, 404);
  assert.equal(providerPayload.reportContext.reference, 'private-assistant-report');

  const otherToken = `Bearer ${createToken({
    id: 'resident-2',
    email: 'other-resident@example.test',
    role: 'resident',
  })}`;
  const unauthorized = await request(`/api/assistant/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: otherToken },
    body: JSON.stringify({ content: 'Tell me the other report status.', reportReference: 'another-residents-report' }),
  });
  assert.equal(unauthorized.status, 404);
  assert.equal(providerPayload.reportContext.reference, 'private-assistant-report');
});

test('AI assistant message requests are rate limited per client', async () => {
  app.locals.assistantProvider = async () => 'Verified assistant reply.';
  const created = await request('/api/assistant/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: residentAuthorization },
    body: JSON.stringify({}),
  });
  const conversationId = created.body.conversation.id;
  let lastStatus = 0;
  for (let attempt = 0; attempt < 21; attempt += 1) {
    const response = await request(`/api/assistant/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: residentAuthorization,
        'X-Forwarded-For': '198.51.100.200',
      },
      body: JSON.stringify({ content: `Question ${attempt}` }),
    });
    lastStatus = response.status;
  }
  assert.equal(lastStatus, 429);
});

test('AI provider failures return an error and do not persist a partial turn', async () => {
  app.locals.assistantProvider = async () => {
    throw new Error('provider timeout with private user content: sensitive question');
  };
  const created = await request('/api/assistant/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: residentAuthorization },
    body: JSON.stringify({}),
  });
  const conversationId = created.body.conversation.id;
  const loggedErrors = [];
  const originalConsoleError = console.error;
  console.error = (...args) => loggedErrors.push(args);
  let sent;
  try {
    sent = await request(`/api/assistant/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: residentAuthorization },
      body: JSON.stringify({ content: 'Please help with private account issue.' }),
    });
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(sent.status, 503);
  assert.match(sent.body.message, /temporarily unavailable/);
  assert.deepEqual(loggedErrors, [[
    'AI assistant request failed:',
    { stage: 'provider', errorClass: 'Error', errorCode: 'unknown' },
  ]]);
  assert.equal(JSON.stringify(loggedErrors).includes('sensitive question'), false);
  assert.equal(JSON.stringify(loggedErrors).includes('private account issue'), false);

  const history = await request(`/api/assistant/conversations/${conversationId}/messages`, {
    headers: { Authorization: residentAuthorization },
  });
  assert.equal(history.status, 200);
  assert.deepEqual(history.body.messages, []);
});

test('AI assistant safely logs turn persistence failures without exposing message content', async () => {
  app.locals.assistantProvider = async () => 'Generated answer.';
  app.locals.assistantTurnAppender = async () => {
    const error = new Error('database failure containing private message');
    error.code = 'secret-private-message';
    throw error;
  };
  const created = await request('/api/assistant/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: residentAuthorization },
    body: JSON.stringify({}),
  });
  const conversationId = created.body.conversation.id;
  const loggedErrors = [];
  const originalConsoleError = console.error;
  console.error = (...args) => loggedErrors.push(args);
  let sent;
  try {
    sent = await request(`/api/assistant/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: residentAuthorization },
      body: JSON.stringify({ content: 'This message must not be logged.' }),
    });
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(sent.status, 503);
  assert.equal(sent.body.message, 'The AI assistant is temporarily unavailable. Please try again.');
  assert.deepEqual(loggedErrors, [[
    'AI assistant request failed:',
    { stage: 'turn_persistence', errorClass: 'Error', errorCode: 'unknown' },
  ]]);
  assert.equal(JSON.stringify(loggedErrors).includes('private message'), false);
  assert.equal(JSON.stringify(loggedErrors).includes('must not be logged'), false);
});

test.skip('resident and staff can exchange persisted support messages with per-user unread state', async () => {
  const emptyMessage = await request(`/api/chat/conversations/${crypto.randomUUID()}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: residentAuthorization },
    body: JSON.stringify({ content: '   ' }),
  });
  assert.equal(emptyMessage.status, 400);

  const created = await request('/api/chat/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: residentAuthorization },
    body: JSON.stringify({}),
  });
  assert.equal(created.status, 201);
  const conversationId = created.body.conversation.id;

  const residentMessage = await request(`/api/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: residentAuthorization },
    body: JSON.stringify({ content: 'Please can someone assist?' }),
  });
  assert.equal(residentMessage.status, 201);
  assert.equal(residentMessage.body.message.senderRole, 'resident');

  const waitingForStaff = await request('/api/chat/conversations', {
    headers: { Authorization: staffAuthorization },
  });
  assert.equal(waitingForStaff.body.conversations[0].status, 'awaiting_response');

  const staffMessage = await request(`/api/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: staffAuthorization },
    body: JSON.stringify({ content: 'We have received your request.' }),
  });
  assert.equal(staffMessage.status, 201);

  const residentConversations = await request('/api/chat/conversations', {
    headers: { Authorization: residentAuthorization },
  });
  assert.equal(residentConversations.status, 200);
  assert.equal(residentConversations.body.conversations[0].unreadCount, 1);
  assert.equal(residentConversations.body.conversations[0].status, 'open');

  const history = await request(`/api/chat/conversations/${conversationId}/messages`, {
    headers: { Authorization: residentAuthorization },
  });
  assert.equal(history.status, 200);
  assert.deepEqual(history.body.messages.map((message) => message.content), [
    'Please can someone assist?',
    'We have received your request.',
  ]);

  const markedRead = await request(`/api/chat/conversations/${conversationId}/read`, {
    method: 'POST',
    headers: { Authorization: residentAuthorization },
  });
  assert.equal(markedRead.status, 200);
  const refreshed = await request('/api/chat/conversations', {
    headers: { Authorization: residentAuthorization },
  });
  assert.equal(refreshed.body.conversations[0].unreadCount, 0);
});

test.skip('report-linked support verifies report ownership and current staff municipality authorization', async () => {
  const store = readStore();
  store.reports.push({
    id: 'linked-support-report',
    title: 'Linked report',
    residentId: 'resident-1',
    municipalityId: 'ZA-MOCK',
    location: { municipalityId: 'ZA-MOCK' },
  });
  store.users.push({
    id: 'resident-2',
    name: 'Other Resident',
    email: 'other-resident@example.test',
    password: 'scrypt:fixture:hash',
  });
  store.admins.push({
    id: 'staff-2',
    name: 'Unassigned Staff',
    email: 'unassigned@example.test',
    password: 'scrypt:fixture:hash',
    role: 'staff',
    isActive: true,
  });
  writeStore(store);

  const linked = await request('/api/chat/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: residentAuthorization },
    body: JSON.stringify({ reportId: 'linked-support-report' }),
  });
  assert.equal(linked.status, 201);

  const otherResidentToken = `Bearer ${createToken({
    id: 'resident-2',
    email: 'other-resident@example.test',
    role: 'resident',
  })}`;
  const attemptedCreate = await request('/api/chat/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: otherResidentToken },
    body: JSON.stringify({ reportId: 'linked-support-report' }),
  });
  assert.equal(attemptedCreate.status, 404);

  const outsiderRead = await request(`/api/chat/conversations/${linked.body.conversation.id}/messages`, {
    headers: { Authorization: otherResidentToken },
  });
  assert.equal(outsiderRead.status, 404);
  const residentList = await request('/api/chat/conversations', {
    headers: { Authorization: otherResidentToken },
  });
  assert.equal(residentList.status, 200);
  assert.equal(residentList.body.conversations.length, 0);

  const outsiderStaffToken = `Bearer ${createToken({
    id: 'staff-2',
    email: 'unassigned@example.test',
    role: 'staff',
    municipalityId: 'ZA-MOCK',
    accessCodeVersion: 1,
  })}`;
  const unauthorizedStaffRead = await request(`/api/chat/conversations/${linked.body.conversation.id}/messages`, {
    headers: { Authorization: outsiderStaffToken },
  });
  assert.equal(unauthorizedStaffRead.status, 404);

  const authorizedStaffRead = await request(`/api/chat/conversations/${linked.body.conversation.id}/messages`, {
    headers: { Authorization: staffAuthorization },
  });
  assert.equal(authorizedStaffRead.status, 200);
  assert.equal(authorizedStaffRead.body.conversation.reportTitle, 'Linked report');
  const superAdminRead = await request(`/api/chat/conversations/${linked.body.conversation.id}/messages`, {
    headers: { Authorization: superAdminAuthorization },
  });
  assert.equal(superAdminRead.status, 200);
});

test.skip('Socket.IO rejects unauthenticated clients, authorizes room joins, and delivers messages in real time', async () => {
  const { createServer } = require('node:http');
  const { io: connectSocket } = require('socket.io-client');
  const store = readStore();
  const conversationId = crypto.randomUUID();
  store.chatConversations.push({
    id: conversationId,
    residentId: 'resident-1',
    reportId: null,
    status: 'open',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastMessageAt: new Date().toISOString(),
    messages: [],
    readAt: {},
  });
  store.users.push({
    id: 'resident-2',
    name: 'Other Resident',
    email: 'other-resident@example.test',
    password: 'scrypt:fixture:hash',
  });
  writeStore(store);

  const server = createServer(app);
  const socketServer = attachChatRealtime(server);
  await new Promise((resolve) => server.listen(0, resolve));
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;
  const residentToken = createToken({
    id: 'resident-1',
    name: 'Test Resident',
    email: 'fixture-resident@example.test',
    role: 'resident',
  });
  const staffToken = createToken({
    id: 'staff-1',
    email: 'staff@example.test',
    role: 'staff',
    municipalityId: 'ZA-MOCK',
    accessCodeVersion: 1,
  });

  function connect(cookie) {
    const socket = connectSocket(url, {
      autoConnect: false,
      transports: ['websocket'],
      extraHeaders: {
        Origin: 'http://localhost:3000',
        ...(cookie ? { Cookie: `msr_session=${cookie}` } : {}),
      },
    });
    return socket;
  }

  async function waitForConnection(socket) {
    const connected = new Promise((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
    socket.connect();
    return connected;
  }

  try {
    const anonymousSocket = connect();
    await assert.rejects(waitForConnection(anonymousSocket), /Authentication is required/);
    anonymousSocket.close();

    const residentSocket = connect(residentToken);
    const staffSocket = connect(staffToken);
    await Promise.all([waitForConnection(residentSocket), waitForConnection(staffSocket)]);
    const joined = await new Promise((resolve) =>
      residentSocket.emit('chat:join', { conversationId }, resolve),
    );
    assert.deepEqual(joined, { ok: true });

    const unauthorizedToken = createToken({
      id: 'resident-2',
      email: 'other-resident@example.test',
      role: 'resident',
    });
    const outsiderSocket = connect(unauthorizedToken);
    await waitForConnection(outsiderSocket);
    const denied = await new Promise((resolve) =>
      outsiderSocket.emit('chat:join', { conversationId }, resolve),
    );
    assert.equal(denied.ok, false);

    const residentDelivery = new Promise((resolve) => residentSocket.once('chat:message', resolve));
    const staffDelivery = new Promise((resolve) => staffSocket.once('chat:message', resolve));
    const sent = await request(`/api/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${residentToken}` },
      body: JSON.stringify({ content: 'Can you help with this issue?' }),
    });
    assert.equal(sent.status, 201);
    const [residentMessage, staffMessage] = await Promise.all([residentDelivery, staffDelivery]);
    assert.equal(residentMessage.id, sent.body.message.id);
    assert.equal(staffMessage.id, sent.body.message.id);

    residentSocket.close();
    staffSocket.close();
    outsiderSocket.close();
  } finally {
    await new Promise((resolve) => socketServer.close(resolve));
  }
});
