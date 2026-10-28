const { test, expect } = require('@playwright/test');

// Checks the Leads page and Add lead form on mobile and tablet screens.
// Screenshots are saved in screenshots/Lead-Responsive/ as proof.
const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
];

for (const vp of viewports) {
  test(`Leads responsive - ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const shot = (step) => page.screenshot({ path: `screenshots/Lead-Responsive/${vp.name}-${step}.png` });

    // Page must not scroll horizontally
    const checkNoHorizontalScroll = async (label) => {
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      console.log(`[${vp.name}] ${label}: scrollWidth=${scrollWidth} clientWidth=${clientWidth}`);
      expect.soft(scrollWidth, `${label} has horizontal scroll`).toBeLessThanOrEqual(clientWidth);
    };

    // Navigate to application
    await page.goto("https://staging.pipeclose.com/", { waitUntil: 'domcontentloaded' });

    // Dismiss cookie consent if shown
    await page.getByRole('button', { name: 'Accept', exact: true }).click({ timeout: 8000 }).catch(() => {});

    // On small screens Log in is inside the hamburger menu
    const loginBtn = page.getByRole('button', { name: 'Log in', exact: true });
    const menuBtn = page.getByRole('button', { name: 'Open menu' });
    await loginBtn.or(menuBtn).first().waitFor({ state: 'visible', timeout: 15000 });
    await shot('01-landing');
    if (!await loginBtn.isVisible()) {
      console.log(`[${vp.name}] Log in hidden, opening hamburger menu`);
      await menuBtn.click();
      await page.waitForTimeout(1000);
      await shot('02-menu-open');
    }
    await loginBtn.or(page.getByRole('link', { name: 'Log in' })).first().click();

    // Login
    const emailField = page.getByPlaceholder("Email");
    await emailField.waitFor({ state: 'visible', timeout: 15000 });
    await checkNoHorizontalScroll('login page');
    await shot('03-login');
    await emailField.fill("ashishappnox1@gmail.com");
    await page.getByPlaceholder("Password").fill("Ashish@567");
    await page.locator("//button[@type='submit']").click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(3000);
    await shot('04-after-login');

    // Navigate to Leads (link may be hidden on small screens)
    const leadLink = page.locator('a[href="/leads"]').first();
    const leadLinkVisible = await leadLink.isVisible();
    console.log(`[${vp.name}] Leads nav link visible: ${leadLinkVisible}`);
    if (leadLinkVisible) await leadLink.click();
    else await page.goto('https://staging.pipeclose.com/leads');
    await page.waitForURL(/\/leads/i);
    await page.waitForTimeout(5000);
    await checkNoHorizontalScroll('leads list');
    await shot('05-leads-list');
    await page.screenshot({ path: `screenshots/Lead-Responsive/${vp.name}-06-leads-list-full.png`, fullPage: true });

    // Open the Add lead form
    const plusLeadButton = page.locator('button:has(svg.lucide-plus)', { hasText: "Lead" });
    await expect(plusLeadButton).toBeVisible({ timeout: 10000 });
    await plusLeadButton.click();
    await page.waitForTimeout(2000);
    await checkNoHorizontalScroll('add lead form');
    await shot('07-add-lead-form');

    // Fill the form (not saved, so no test data is created)
    await page.getByPlaceholder('name').first().fill('Responsive Test');
    const orgField = page.getByPlaceholder('name').nth(1);
    await orgField.click();
    await orgField.type('Pipeclose');
    await page.waitForTimeout(1000);
    await shot('08-form-top-filled');
    const phoneField = page.getByPlaceholder('Phone number');
    await phoneField.scrollIntoViewIfNeeded();
    await phoneField.fill('9983483883');
    await page.waitForTimeout(500);
    await shot('09-form-contact-filled');

    // Save and Cancel must be reachable on screen
    const saveButton = page.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeInViewport();

    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.waitForTimeout(1000);
    await shot('10-after-cancel');
  });
}
