/* eslint-disable no-console */
// Simple script to test frontend-related endpoints used by hooks/components
// Run: node scripts/test-frontend-hooks.js

const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
const TOKEN = process.env.TOKEN;

const defaultHeaders = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};

async function doFetch(url, options = {}) {
  const headers = { ...(options.headers || {}), ...defaultHeaders };
  if (typeof fetch === 'function') {
    return fetch(url, { ...options, headers });
  }
  // Fallback to https module if fetch is not available
  const { request } = require(url.startsWith('https') ? 'https' : 'http');
  return new Promise((resolve, reject) => {
    const req = request(url, { method: options.method || 'GET', headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          async json() {
            try { return JSON.parse(data || '{}'); } catch { return { raw: data }; }
          }
        });
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function main() {
  try {
    console.log('== Test financial-report/summary ==');
    const r1 = await doFetch(`${BASE_URL}/api/report/financial-report/summary?from=2025-01-01&to=2025-12-31&branch=all`);
    console.log('status:', r1.status);
    console.log(await r1.json());

    console.log('== Test cashbook/contents ==');
    const r2 = await doFetch(`${BASE_URL}/api/cashbook/contents?limit=5`);
    console.log('status:', r2.status);
    console.log(await r2.json());

    console.log('== Test activity-logs ==');
    const r3 = await doFetch(`${BASE_URL}/api/activity-logs?page=1&limit=5`);
    console.log('status:', r3.status);
    console.log(await r3.json());
  } catch (e) {
    console.error('Test error:', e);
    process.exit(1);
  }
}

main();


