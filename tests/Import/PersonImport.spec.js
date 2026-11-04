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

    // Navigate to import section 
    try {
  const mailLink = page.locator('a[href="/import"]').first();

  await mailLink.waitFor({ state: 'visible', timeout: 10000 });

  await Promise.all([
    page.waitForURL('**/import'),
    mailLink.click()
  ]);

} catch (error) {
  throw new Error(`Failed to navigate to import: ${error.message}`);
}

await page.waitForTimeout(1000);

//click on new import
await page.getByText('New Import').click();

// select the people
await page.locator('.entity-card', { hasText: 'People (Contacts)' }).click();

// click on next button
await page.getByRole('button', { name: 'Continue' }).click();
await page.waitForTimeout(1000);

// enter the file
await page.locator('input[type="file"]').setInputFiles(
  'C:\\Users\\user\\Downloads\\people_pipedrive.csv'
);

// click on upload and continue button
await page.getByText('Upload & Continue').click();

// click on the Validate and continue button
await page.getByText('Validate & Continue').click();
await page.waitForTimeout(1000);


// click on the start import button
await page.getByText('Start Import').click();
await page.waitForTimeout(1000);

// click on view imported data button
await page.getByText('View Import History').click();
await page.waitForTimeout(1000);




  } catch (error) {
    console.error("Test error:", error.message);
    throw error;
  }

});

