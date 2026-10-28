const { test, expect } = require('@playwright/test');

test("valid login", async function ({ page }) {

    // Navigate to application with error handling
    try {
      await page.goto("https://staging.pipeclose.com/", { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');
    } catch (error) {
      throw new Error(`Failed to navigate to website: ${error.message}`);
    }
    // Dismiss cookie consent if shown
    const acceptCookies = page.getByRole('button', { name: 'Accept', exact: true });
    await acceptCookies.click({ timeout: 5000 }).catch(() => {});

    // Open login form unless it is already shown
    const loginBtn = page.getByRole('button', { name: 'Log in', exact: true });
    const emailInput = page.getByPlaceholder("Email");
    await loginBtn.or(emailInput).first().waitFor({ state: 'visible', timeout: 15000 });
    if (await loginBtn.isVisible()) await loginBtn.click();
    await page.waitForTimeout(1000);

    // Login with validation
    try {
      const emailField = page.getByPlaceholder("Email");
      await emailField.waitFor({ state: 'visible', timeout: 15000 })
        .catch(() => { throw new Error("Email field not visible on login page"); });
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

    // Navigate to Lead section
    try {
      // Wait for redirect or navigation after login
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000); // Give time for any redirect
      const currentUrl = page.url();
      console.log('Current URL after login:', currentUrl);
      if (!/\/leads/i.test(currentUrl)) {
        const leadLink = page.locator('a[href="/leads"]').first();
        await leadLink.waitFor({ state: 'visible', timeout: 10000 });
        await Promise.all([
          page.waitForURL(/\/leads/i),
          leadLink.click()
        ]);
        console.log('Clicked Leads link and navigated.');
      } else {
        // Already on Leads page
        await page.waitForSelector('body');
        console.log('Already on Leads page.');
      }
    } catch (error) {
      throw new Error(`Failed to navigate to Leads: ${error.message}`);
    }

    await page.waitForTimeout(1000);

    // Count existing leads with the same name so the new one can be detected
    const leadName = 'Kunal Sharma';
    const leadRows = page.getByText(leadName, { exact: true });
    await page.waitForTimeout(3000);
    const countBefore = await leadRows.count();

    // Click on the +Lead button to create a new lead
    const plusLeadButton = page.locator('button:has(svg.lucide-plus)', { hasText: "Lead" });
    await plusLeadButton.waitFor({ state: 'visible', timeout: 10000 });
    await plusLeadButton.click();

    // Enter  the contact person name
await page.getByPlaceholder('name').first().fill('Kunal Sharma');

// Enter the organization name 
const orgField = page.getByPlaceholder('name').nth(1);
await orgField.click();
await orgField.type('Pipeclose Technologies');
await page.waitForTimeout(1000);

// Enter the value
await page.getByPlaceholder('0').first().fill('90000');
await page.waitForTimeout(1500);

// Enter the requirements
await page.getByPlaceholder("Details about the lead's needs...").fill('CRM system for sales management');
await page.waitForTimeout(1500);

// Enter the phone number
await page.getByPlaceholder('Phone number').fill('7089829839');
await page.waitForTimeout(1500);

// Enter the email
await page.getByPlaceholder('Email address').fill('kunal.sharma@appnox.com');
await page.waitForTimeout(1000);

// Click on save button
const saveButton = page.getByRole('button', { name: 'Save' });
await saveButton.click();

// The Add lead form must close after a successful save
await expect(page.getByRole('heading', { name: 'Add lead' })).toBeHidden({ timeout: 30000 });

// The Leads list must contain one more lead with this name than before
await expect.poll(() => leadRows.count(), { timeout: 30000 }).toBeGreaterThan(countBefore);
console.log(`Lead "${leadName}" created (${countBefore} -> ${await leadRows.count()} in Leads list).`);

// Take screenshot to see the result after lead creation
await page.screenshot({ path: 'screenshots/Lead5-Created-Successfully.png' });
console.log('✓ Screenshot saved: screenshots/Lead5-Created-Successfully.png');

});

