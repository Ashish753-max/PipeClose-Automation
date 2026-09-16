const { test, expect } = require('@playwright/test');

test("valid login", async function ({ page }) {

    try {
    // Navigate to application with error handling
    try {
      await page.goto("https://pipeclose.com/", { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');
    } catch (error) {
      throw new Error(`Failed to navigate to website: ${error.message}`);
    }
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await page.waitForTimeout(1000);

    // Login with validation
    try {
      const emailField = page.getByPlaceholder("Email");
      if (!await emailField.isVisible({ timeout: 5000 })) {
        throw new Error("Email field not visible on login page");
      }
      await emailField.fill("ashishappnox1@gmail.com");
      await page.waitForTimeout(500);

      const passwordField = page.getByPlaceholder("Password");
      if (!await passwordField.isVisible({ timeout: 5000 })) {
        throw new Error("Password field not visible on login page");
      }
      await passwordField.fill("Ashish@567");
      await page.waitForTimeout(500);

      const submitButton = page.locator("//button[@type='submit']");
      if (!await submitButton.isVisible()) {
        throw new Error("Submit button not found");
      }
      await submitButton.click();

    } catch (error) {
      throw new Error(`Login failed: ${error.message}`);
    }

    // click on the prospect section
    await page.getByRole('link', { name: 'Prospects' }).click();

    // Wait for 5 seconds to ensure dashboard is loaded, then take final screenshot
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'screenshots/CRM Login-end.png' });

  } catch (error) {
    console.error("Test error:", error.message);
    throw error;
  }

});

