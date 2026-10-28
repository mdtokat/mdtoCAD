// Playwright test yapılandırması.
// WebGL, başsız tarayıcıda yazılımsal (SwiftShader) olarak çalıştırılır.
// Yerelde farklı bir Chromium kullanmak için: PW_CHROMIUM=/yol/chrome npm test
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    viewport: { width: 1400, height: 860 },
    launchOptions: {
      executablePath: process.env.PW_CHROMIUM || undefined,
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
});
