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

  //click on the add activity button
  const addActivityButton = page.locator('button:has-text("Activity")');
  await addActivityButton.click();

  // click on the task option
  await page.locator('button[title="Email"]').click();

  // add the title of the activity
  const titleField = page.getByPlaceholder("Activity title");
  await titleField.fill("Email for Govind");

 /* // click on the starting time dropdown
  const timeDropdowns = page.locator('//button[@role="combobox" and .//span[normalize-space()="HH:MM"]]');
  const startingTimeDropdown = timeDropdowns.nth(0);
  await startingTimeDropdown.scrollIntoViewIfNeeded();
  await startingTimeDropdown.click({ force: true });
  await page.waitForTimeout(500);
  await page.getByRole('option', { name: '12:00 AM' }).click();
  await page.waitForTimeout(500);   */

  /*// click on the ending time dropdown
  const endingTimeDropdown = page.locator('//button[@role="combobox" and .//span[normalize-space()="HH:MM"]]').last();
  await endingTimeDropdown.scrollIntoViewIfNeeded();
  await endingTimeDropdown.click({ force: true });
  await page.waitForTimeout(500);
  await page.getByRole('option', { name: '12:30 AM' }).click();  */

  // click on the schedule button
  await page.waitForTimeout(1000);
  const scheduleButton = page.getByRole('button', { name: 'Schedule', exact: true });
  await scheduleButton.waitFor({ state: 'attached' });
  await scheduleButton.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  try {
    await scheduleButton.click({ force: true });
  } catch (error) {
    await scheduleButton.evaluate((button) => button.click());
  }
  await page.waitForTimeout(1000);

 await page.screenshot({ path: 'screenshots/CreateActivityEmail5-end.png' });


});