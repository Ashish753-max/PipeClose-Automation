const { test, expect } = require('@playwright/test');

test("valid login", async function ({ page }) {

    try {
    // Navigate to application with error handling
    try {
      await page.goto("https://staging.pipeclose.com/", { waitUntil: 'networkidle' });
      await page.waitForLoadState('networkidle');
    } catch (error) {
      throw new Error(`Failed to navigate to website: ${error.message}`);
    }
    
    // Wait for button to be visible and clickable
    const button = page.locator('button:has-text("Try it free")').first();
    await button.waitFor({ state: 'visible', timeout: 10000 });
    await button.click({ timeout: 5000 });
    console.log("Try it free button clicked successfully");
    await page.waitForTimeout(2000);

    // Wait for 5 seconds to ensure dashboard is loaded, then take final screenshot
    //await page.waitForTimeout(000);
    await page.screenshot({ path: 'screenshots/Dashboard Try it free-end.png' });

  } catch (error) {
    console.error("Test error:", error.message);
    throw error;
  }

});

