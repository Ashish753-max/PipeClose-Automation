const { test, expect } = require('@playwright/test');

test("valid login", async function ({ page }) {

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

    // click on the export section
    await page.getByRole('link', { name: 'Export' }).click();
    await page.waitForTimeout(1000);

    // click on notes button
            await page.getByRole('button', { name: 'Leads', exact: true }).click();

            // click on the not archived button
            await page.getByRole('button', { name: 'Not archived', exact: true }).click();

            // select all leads
            await page.getByRole('button', { name: 'Select All', exact: true }).click();

            // click on the export button
            await page.getByRole('button', { name: 'Export', exact: true }).click();
            await page.waitForTimeout(1000);

            // click on the download button
            await page.getByRole('button', { name: 'Download', exact: true }).click();
            await page.waitForTimeout(1000);

            // Take final screenshot
    await page.screenshot({ path: 'screenshots/LeadsNotArchivedCSVExport-end.png' });


    

  } catch (error) {
    console.error("Test error:", error.message);
    throw error;
  }

});

