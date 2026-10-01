const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { test, beforeEach, afterEach, after } = require('node:test');

process.env.USE_FILE_STORE = 'true';
process.env.NODE_ENV = 'test';
process.env.ADMIN_REGISTRATION_KEYS = 'staff-invite-test-key,second-staff-invite-test-key';
process.env.SUPER_ADMIN_BOOTSTRAP_TOKEN = 'bootstrap-test-only-token';
const testStoreDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'municipal-service-api-test-'));
process.env.DATA_STORE_PATH = path.join(testStoreDirectory, 'store.json');
const assert = require('node:assert/strict');
const { getStaffByIdFromDb } = require('../db');

const { app, readStore, writeStore, createToken } = require('../index.js');
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
  });
}

function resetStore() {
  writeTestStore();
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

beforeEach(() => {
  resetStore();
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

  const saved = await request(`/api/admin/municipalities/${testMunicipality.id}/generate-access-code`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: superAdminAuthorization },
    body: JSON.stringify({ accessCode: customCode }),
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.accessCode, undefined);
  assert.match(readStore().municipalities[0].accessCodeHash, /^scrypt:/);
  assert.notEqual(readStore().municipalities[0].accessCodeHash, customCode);

  const invalid = await request(`/api/admin/municipalities/${testMunicipality.id}/generate-access-code`, {
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

  const reset = await request(`/api/admin/municipalities/${testMunicipality.id}/generate-access-code`, {
    method: 'POST', headers: { Authorization: superAdminAuthorization },
  });
  assert.equal(reset.status, 200);
  assert.equal(typeof reset.body.accessCode, 'string');
  assert.notEqual(readStore().municipalities[0].accessCodeHash, reset.body.accessCode);
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
  const codeManagement = await request('/api/admin/municipalities/ZA-OTHER/generate-access-code', {
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
  assert.equal(createResponse.body.report.reportedBy, undefined);
  assert.equal(createResponse.body.report.residentId, undefined);

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
