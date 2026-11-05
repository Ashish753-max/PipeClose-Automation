// tests/common/auth.js
// Reusable login function for Playwright

// Current credentials:
// email: ashishappnox1@gmail.com
// password: Ashish@567
const loginConfig = require('./loginConfig');

/**
 * Logs in to the application using Playwright's page object.
 * @param {import('@playwright/test').Page} page
 */
async function login(page) {
  await page.goto('https://staging.pipeclose.com/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('link', { name: /^Log in/ }).first().click();
  await page.getByPlaceholder('Email').waitFor({ timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.getByPlaceholder('Email').fill(loginConfig.email);
  await page.waitForTimeout(500);
  await page.getByPlaceholder('Password').fill(loginConfig.password);
  await page.waitForTimeout(500);
  await page.locator("//button[@type='submit']").click();
}

module.exports = login;
