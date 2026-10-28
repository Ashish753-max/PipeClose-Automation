const { test, expect } = require('@playwright/test');

test("Navigate to Campaign module", async function ({ page }) {

    // Navigate to application
    try {
      await page.goto("https://staging.pipeclose.com/", { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');
    } catch (error) {
      throw new Error(`Failed to navigate to website: ${error.message}`);
    }

    // Open login form if the landing page shows a Log in button
    const loginButton = page.getByRole('button', { name: 'Log in', exact: true });
    if (await loginButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await loginButton.click();
    }

    await page.waitForTimeout(1000);

    // Login with validation
    try {
      const emailField = page.getByPlaceholder("Email");
      await emailField.waitFor({ state: 'visible', timeout: 10000 });
      await emailField.fill("ashishappnox1@gmail.com");
      await page.waitForTimeout(500);

      const passwordField = page.getByPlaceholder("Password");
      await passwordField.waitFor({ state: 'visible', timeout: 5000 });
      await passwordField.fill("Ashish@567");
      await page.waitForTimeout(500);

      const submitButton = page.locator("//button[@type='submit']");
      await submitButton.click();
    } catch (error) {
      throw new Error(`Login failed: ${error.message}`);
    }

    // Navigate to Campaign module
    try {
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      console.log('Current URL after login:', page.url());

      const campaignLink = page.locator('a[href*="campaign" i]')
        .or(page.getByRole('link', { name: /campaign/i }))
        .first();
      await campaignLink.waitFor({ state: 'visible', timeout: 15000 });
      await Promise.all([
        page.waitForURL(/campaign/i),
        campaignLink.click()
      ]);
      console.log('Navigated to Campaign module:', page.url());
    } catch (error) {
      throw new Error(`Failed to navigate to Campaign module: ${error.message}`);
    }

    await expect(page).toHaveURL(/campaign/i);
});
