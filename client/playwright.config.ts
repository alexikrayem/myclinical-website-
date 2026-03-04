import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import dotenv from 'dotenv';

const envCandidates = [
  path.resolve(__dirname, '.env.e2e'),
  path.resolve(__dirname, '../.env.e2e'),
];

for (const envPath of envCandidates) {
  dotenv.config({ path: envPath, override: false });
}

const backendPort = Number(process.env.PORT || 5001);
const apiUrl = process.env.VITE_API_URL || process.env.E2E_API_URL || `http://127.0.0.1:${backendPort}`;
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const baseUrl = process.env.E2E_CLIENT_BASE_URL || 'http://127.0.0.1:5173';
const useMocks = process.env.E2E_USE_MOCKS === '1';
const hasBackendEnv = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);

const webServers = [
  {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_API_URL: apiUrl,
      VITE_SUPABASE_URL: supabaseUrl || '',
      VITE_SUPABASE_ANON_KEY: supabaseAnonKey || '',
    },
  },
];

if (!useMocks && hasBackendEnv) {
  webServers.push({
    command: 'npm run dev',
    port: backendPort,
    reuseExistingServer: !process.env.CI,
    cwd: path.resolve(__dirname, '../backend'),
    env: {
      NODE_ENV: process.env.NODE_ENV || 'development',
      PORT: String(backendPort),
      SUPABASE_URL: process.env.SUPABASE_URL || '',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      JWT_SECRET: process.env.JWT_SECRET || '',
      ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || '',
      MOCK_VIDEO_API: process.env.MOCK_VIDEO_API || 'true',
    },
  });
}

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['github'], ['junit', { outputFile: 'results.xml' }]]
    : [['list'], ['html']],
  use: {
    baseURL: baseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: webServers,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
