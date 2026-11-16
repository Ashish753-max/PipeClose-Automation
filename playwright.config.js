// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  /* On CI, skip the practice scripts and the tests of other websites: they are not part of the CRM suite */
  testIgnore: process.env.CI ? [
    '**/Practice/**',
    '**/Basic Script/**',
    '**/Login/LoginPractice.spec.js',
    '**/Login/TMLoginSuccessful.spec.js',
  ] : [],
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* How many tests run at once: set WORKERS to choose. On CI 2 by default, as staging slows down
     when many tests hit it together (all tests also share one account). */
  workers: process.env.WORKERS ? Number(process.env.WORKERS) : (process.env.CI ? 2 : undefined),
  /* Reporter to use. See https://playwright.dev/docs/test-reporters
     On CI: a line per test in the build log, the HTML report, and JUnit results for Jenkins' test trend. */
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }], ['junit', { outputFile: 'test-results/junit.xml' }]]
    : 'html',
  /* Set timeout for individual test actions */
  timeout: 120000, // 120 seconds
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    // baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Video of every test when run locally. On CI only failed tests keep theirs, to keep builds small and fast.
       Videos are saved with each test's results in test-results/. */
    video: {
      mode: process.env.CI ? 'retain-on-failure' : 'on',
      size: { width: 1280, height: 720 },
    },
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
      },
      outputDir: 'test-results/chromium',
    },
  /*  {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },    */

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});

