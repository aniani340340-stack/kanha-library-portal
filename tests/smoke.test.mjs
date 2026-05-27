/**
 * Local smoke tests — run while the app is running:
 *   Terminal 1: npm run dev
 *   Terminal 2: npm test
 *
 * Or production build:
 *   npm run build && npm start
 *   npm test
 */

import { test, before, describe } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.TEST_API_URL || 'http://localhost:5000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@kanhalibrary.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'KanhaAdmin@2024';

let authToken = '';
let createdStudentId = null;
const testSeat = `T${Date.now().toString().slice(-4)}`;

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (authToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  if (options.json) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.json);
    delete options.json;
  }
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  let body = null;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body, status: res.status };
}

before(async () => {
  try {
    const health = await fetch(`${BASE}/api/auth/login`, { method: 'OPTIONS' }).catch(() => null);
    const ping = await fetch(BASE).catch(() => null);
    if (!ping && !health) {
      throw new Error(
        `Cannot reach ${BASE}. Start the server first:\n  npm run dev`
      );
    }
  } catch (e) {
    if (e.message.includes('Start the server')) throw e;
    throw new Error(`Cannot reach ${BASE}. Run: npm run dev`);
  }
});

describe('Authentication', () => {
  test('rejects wrong password', async () => {
    const { status } = await api('/api/auth/login', {
      method: 'POST',
      json: { email: ADMIN_EMAIL, password: 'wrong-password-xyz' }
    });
    assert.equal(status, 401);
  });

  test('login with admin credentials', async () => {
    const { status, body } = await api('/api/auth/login', {
      method: 'POST',
      json: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
    });
    assert.equal(status, 200);
    assert.ok(body.token, 'Expected token in login response');
    assert.ok(body.email);
    authToken = body.token;
  });

  test('blocks API without token', async () => {
    const prev = authToken;
    authToken = '';
    const { status } = await api('/api/students');
    authToken = prev;
    assert.equal(status, 401);
  });

  test('GET /api/auth/me returns admin email', async () => {
    const { status, body } = await api('/api/auth/me');
    assert.equal(status, 200);
    assert.ok(body.email);
  });
});

describe('Students & data persistence', () => {
  const today = new Date().toISOString().split('T')[0];

  test('GET /api/stats returns overview', async () => {
    const { status, body } = await api('/api/stats');
    assert.equal(status, 200);
    assert.equal(typeof body.total, 'number');
    assert.equal(typeof body.active, 'number');
    assert.ok(Array.isArray(body.occupiedSeats));
  });

  test('register a test student', async () => {
    const form = new FormData();
    form.append('name', 'Smoke Test Student');
    form.append('phone', '9999900001');
    form.append('whatsapp', '9999900001');
    form.append('seat_number', testSeat);
    form.append('duration', '1');
    form.append('start_date', today);
    form.append('rate', '1000');
    form.append('discount', '0');
    form.append('total_fees', '1000');
    form.append('fee_status', 'Paid');
    form.append('amount_paid', '1000');

    const res = await fetch(`${BASE}/api/students`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: form
    });
    const body = await res.json();
    assert.equal(res.status, 201, body.error || 'Register failed');
    assert.ok(body.id);
    createdStudentId = body.id;
  });

  test('student appears in active list', async () => {
    const { status, body } = await api('/api/students');
    assert.equal(status, 200);
    assert.ok(Array.isArray(body));
    const found = body.find((s) => s.id === createdStudentId);
    assert.ok(found, 'Created student should be in list');
    assert.equal(found.seat_number, testSeat);
  });

  test('archive student (soft delete)', async () => {
    const { status, body } = await api(`/api/students/${createdStudentId}`, {
      method: 'DELETE'
    });
    assert.equal(status, 200);
    assert.match(body.message, /archive/i);
  });

  test('archived student appears in deleted list', async () => {
    const { status, body } = await api('/api/students/archived');
    assert.equal(status, 200);
    const found = body.find((s) => s.id === createdStudentId);
    assert.ok(found, 'Student should be in archive');
    assert.equal(found.archived, 1);
    assert.equal(found.name, 'Smoke Test Student');
  });

  test('restore student to a new seat', async () => {
    const restoreSeat = `${testSeat}R`;
    const { status, body } = await api(`/api/students/${createdStudentId}/restore`, {
      method: 'PUT',
      json: { seat_number: restoreSeat }
    });
    assert.equal(status, 200);
    assert.match(body.message, /restore/i);

    const list = await api('/api/students');
    const found = list.body.find((s) => s.id === createdStudentId);
    assert.ok(found);
    assert.equal(found.seat_number, restoreSeat);
  });

  test('cleanup — archive test student again', async () => {
    const { status } = await api(`/api/students/${createdStudentId}`, {
      method: 'DELETE'
    });
    assert.equal(status, 200);
  });
});

describe('Notifications', () => {
  test('GET /api/notifications returns config', async () => {
    const { status, body } = await api('/api/notifications');
    assert.equal(status, 200);
    assert.equal(typeof body.whatsappConfigured, 'boolean');
    assert.ok(body.adminWhatsApp);
    assert.ok(Array.isArray(body.notifications));
  });

  test('POST /api/notifications/check-expiry runs without error', async () => {
    const { status, body } = await api('/api/notifications/check-expiry', {
      method: 'POST'
    });
    assert.equal(status, 200);
    assert.ok(body.message);
  });
});

describe('Production build (optional)', () => {
  test('frontend index is served when dist exists', async () => {
    const res = await fetch(BASE);
    assert.ok(res.ok, `GET / should return 200 (got ${res.status})`);
    const html = await res.text();
    assert.match(html, /html|root/i);
  });
});
