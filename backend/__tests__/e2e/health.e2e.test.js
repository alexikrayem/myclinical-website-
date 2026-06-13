import request from 'supertest';

const setTestEnv = () => {
  process.env.NODE_ENV = 'test';
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'test-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  process.env.JWT_SECRET = 'test-jwt-secret-with-min-length-32-characters';
};

let app;

beforeAll(async () => {
  setTestEnv();
  const module = await import('../../server.js');
  app = module.default;
});

describe('Backend health checks', () => {
  it('returns health status', async () => {
    const response = await request(app).get('/health');

    expect([200, 207]).toContain(response.status);
    expect(['OK', 'DEGRADED']).toContain(response.body.status);
    expect(response.body.security).toBe('enabled');

  });

  it('returns 404 for unknown API routes', async () => {
    const response = await request(app).get('/api/unknown-endpoint');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ error: 'API endpoint not found' });
  });
});
