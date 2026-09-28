process.env.USE_FILE_STORE = 'true';
process.env.ADMIN_REGISTRATION_KEYS = 'staff-invite-test-key,second-staff-invite-test-key';

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const { app, readStore, writeStore, createToken } = require('../index.js');
const staffAuthorization = `Bearer ${createToken({ id: 'staff-1', email: 'staff@example.test', role: 'admin' })}`;

function resetStore() {
  writeStore({ reports: [], users: [], admins: [] });
}

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  resetStore();
});

async function request(path, options = {}) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      ...options,
      headers: {
        ...(options.headers || {}),
      },
    });

    const body = await response.text();
    return {
      status: response.status,
      body: body ? JSON.parse(body) : null,
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
  assert.ok(registered.every((response) => response.body.token));
  assert.equal(registered[0].body.admin.role, undefined);
  assert.ok(readStore().admins.every((admin) => /^scrypt:/.test(admin.password)));

  const login = await request('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'staff-0@example.test', password: payload.password }),
  });
  assert.equal(login.status, 200);
  assert.ok(login.body.token);
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
    status: 'Reported',
    reportedBy: 'Resident',
    image: '',
  };

  const createResponse = await request('/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  assert.equal(createResponse.status, 201);
  assert.equal(createResponse.body.report.title, payload.title);
  assert.equal(createResponse.body.report.location.latitude, payload.location.latitude);

  const listResponse = await request('/api/reports');
  assert.equal(listResponse.status, 200);
  assert.ok(Array.isArray(listResponse.body.reports));
  assert.equal(listResponse.body.reports.length, 1);

  const reportId = createResponse.body.report.id;
  const deleteResponse = await request(`/api/reports/${reportId}`, {
    method: 'DELETE',
    headers: { Authorization: staffAuthorization },
  });
  assert.equal(deleteResponse.status, 200);

  const finalList = await request('/api/reports');
  assert.equal(finalList.status, 200);
  assert.equal(finalList.body.reports.length, 0);

  writeStore({ reports: [], users: [], admins: [] });
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

  writeStore({ reports: seed, users: [], admins: [] });

  const filtered = await request('/api/reports?category=Pothole&status=Reported');
  assert.equal(filtered.status, 200);
  assert.equal(filtered.body.reports.length, 1);
  assert.equal(filtered.body.reports[0].category, 'Pothole');

  const update = await request(`/api/reports/${filtered.body.reports[0].id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${createToken({ id: 'staff-1', email: 'staff@example.test', role: 'admin' })}`,
    },
    body: JSON.stringify({ status: 'Resolved' }),
  });

  assert.equal(update.status, 200);
  assert.equal(update.body.report.status, 'Resolved');

  const search = await request('/api/reports?search=burst');
  assert.equal(search.status, 200);
  assert.equal(search.body.reports.length, 1);
  assert.equal(search.body.reports[0].category, 'Burst Pipe');

  const clearAll = await request('/api/reports', {
    method: 'DELETE',
    headers: { Authorization: staffAuthorization },
  });
  assert.equal(clearAll.status, 200);
  assert.equal(clearAll.body.removedCount, 2);

  const finalState = await request('/api/reports');
  assert.equal(finalState.status, 200);
  assert.equal(finalState.body.reports.length, 0);

  writeStore({ reports: [], users: [], admins: [] });
});

test('report status changes require a valid staff token and admin role', async () => {
  writeStore({
    reports: [{
      id: 'protected-report',
      title: 'Protected report',
      description: 'A report for auth testing',
      category: 'Pothole',
      location: { latitude: -25.7, longitude: 28.2 },
      priority: 'High',
      status: 'Reported',
      reportedBy: 'Resident',
    }],
    users: [],
    admins: [],
  });
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

  const adminToken = createToken({ id: 'staff-1', email: 'staff@example.test', role: 'admin' });
  const staff = await request(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body,
  });
  assert.equal(staff.status, 200);
  assert.equal(staff.body.report.status, 'Under Review');
});

test('staff triage, assignments, notes, updates, and duplicate links persist with correct visibility', async () => {
  const primary = {
    id: 'primary-report', title: 'Primary pothole', description: 'A pothole', category: 'Pothole',
    location: { latitude: -25.7, longitude: 28.2 }, priority: 'Medium', status: 'Reported',
    reportedBy: 'Resident',
  };
  const duplicate = {
    ...primary, id: 'duplicate-report', title: 'Nearby pothole',
  };
  writeStore({
    reports: [primary, duplicate],
    users: [],
    admins: [{ id: 'staff-1', name: 'Operations Staff', email: 'staff@example.test', password: 'hashed' }],
  });

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

  const publicList = await request('/api/reports');
  const publicDuplicate = publicList.body.reports.find((report) => report.id === 'duplicate-report');
  assert.equal(Object.hasOwn(publicDuplicate, 'staffNotes'), false);

  const canonicalReport = await request('/api/reports/primary-report');
  assert.equal(canonicalReport.body.report.duplicateReports.length, 1);
  assert.equal(canonicalReport.body.report.duplicateReports[0].id, 'duplicate-report');

  const staffReport = await request('/api/admin/reports/duplicate-report', {
    headers: { Authorization: staffAuthorization },
  });
  assert.equal(staffReport.status, 200);
  assert.equal(staffReport.body.report.staffNotes.length, 1);

  const staffList = await request('/api/admin/reports', { headers: { Authorization: staffAuthorization } });
  const staffSummary = staffList.body.reports.find((report) => report.id === 'duplicate-report');
  assert.equal(Object.hasOwn(staffSummary, 'staffNotes'), false);
  assert.equal(staffSummary.assignedStaffName, 'Operations Staff');
  assert.equal(staffSummary.department, 'Roads');
});
