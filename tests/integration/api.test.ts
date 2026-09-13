import { describe, expect, it, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { pool } from '../../src/shared/db';

const app = createApp();

afterAll(async () => {
  await pool.end();
});

describe('health endpoint', () => {
  it('responds with JSON status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThanOrEqual(503);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('checks.database');
  });
});

describe('assistant query validation', () => {
  it('rejects a missing query with 400', async () => {
    const res = await request(app)
      .post('/api/assistant/query')
      .send({ targetLanguage: 'am' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an empty query with 400', async () => {
    const res = await request(app)
      .post('/api/assistant/query')
      .send({ query: '', targetLanguage: 'am' });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid JSON body with 400', async () => {
    const res = await request(app)
      .post('/api/assistant/query')
      .set('Content-Type', 'application/json')
      .send('{not json');
    expect(res.status).toBe(400);
  });

  it('rejects an unknown route with 404', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('web UI', () => {
  it('serves the landing page at /', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('Captain Voice Assistant');
  });

  it('serves static assets from /public', async () => {
    const [css, js] = await Promise.all([
      request(app).get('/style.css'),
      request(app).get('/app.js'),
    ]);
    expect(css.status).toBe(200);
    expect(css.headers['content-type']).toContain('text/css');
    expect(js.status).toBe(200);
    expect(js.headers['content-type']).toContain('javascript');
  });
});