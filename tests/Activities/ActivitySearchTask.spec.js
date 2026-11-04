const { test, expect } = require('@playwright/test');

test("valid login", async ({ page }) => {
  try {
    // Navigate to application with error handling
    try {
      await page.goto("https://staging.pipeclose.com/", { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');
    } catch (error) {
      throw new Error(`Failed to navigate to website: ${error.message}`);
    }
    await page.getByRole('link', { name: /^Log in/ }).first().click();
    await page.getByPlaceholder('Email').waitFor({ timeout: 30000 });
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

    // Wait for dashboard to load
    try {
      await page.waitForLoadState("networkidle", { timeout: 10000 });
      await page.waitForTimeout(2000);
    } catch (error) {
      console.warn(`Dashboard networkidle wait exceeded, continuing anyway: ${error.message}`);
      await page.waitForTimeout(3000);
    }

    // Navigate to Activity section 
    const activity = page.locator('a[href="/activities"]').first();
    await activity.click();

  } catch (error) {
    console.error(error.message);
  }

// enter task in the search bar 
    const searchBar = page.locator('input[placeholder="Search"]');
    await searchBar.fill("Task");
    await page.waitForTimeout(1000);

              // Take final screenshot
              await page.screenshot({ path: 'screenshots/ActivitySearchTask-end.png' });


});