// Playwright drives the system-installed Microsoft Edge (no browser download).
// Default suite uses the deterministic mock player (?player=mock) so timing
// assertions are exact; `npm run test:youtube` exercises real YouTube embeds.
import { defineConfig } from '@playwright/test';

const PORT = 5174;
export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 2,
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: process.env.PW_CHANNEL || 'msedge',
    viewport: { width: 1440, height: 900 },
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] },
    trace: 'retain-on-failure',
  },
  grepInvert: process.env.YT ? undefined : /@youtube/,
  webServer: { command: `node scripts/serve.mjs`, env: { PORT: String(PORT) }, url: `http://localhost:${PORT}`, reuseExistingServer: true },
});
