// tests/common/createDeal.js
// Shared flow for the Deal creation scripts (tests/Deal/CreateDeal*.spec.js)
const { expect } = require('@playwright/test');
const loginConfig = require('./loginConfig');

// Login on staging; waits for whichever of "Log in" link / Email field shows first
async function loginStaging(page) {
  await page.goto('https://staging.pipeclose.com/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Accept', exact: true }).click({ timeout: 4000 }).catch(() => {});

  // The home page shows it as a "Log in ↗" link (it used to be a button)
  const loginBtn = page.getByRole('link', { name: /^Log in/ })
    .or(page.getByRole('button', { name: 'Log in', exact: true })).first();
  const emailField = page.getByPlaceholder('Email');
  await loginBtn.or(emailField).first().waitFor({ state: 'visible', timeout: 30000 });
  if (await loginBtn.isVisible()) await loginBtn.click();

  await emailField.fill(loginConfig.email);
  await page.getByPlaceholder('Password').fill(loginConfig.password);
  await page.locator("//button[@type='submit']").click();
}

/**
 * Logs in, creates a deal and verifies it from the user's point of view.
 * @param {import('@playwright/test').Page} page
 * @param {{ person: string, organization: string, value: string, phone: string, email: string, screenshot: string }} deal
 * @param {{ checkSuccessMessage?: boolean }} [options] set checkSuccessMessage false when the deal is only setup for another test
 */
async function createDeal(page, deal, options) {
  await loginStaging(page);
  await addDeal(page, deal, options);
}

/** Same as createDeal for a user who is already logged in and on the Deals board. */
async function addDeal(page, deal, { checkSuccessMessage = true } = {}) {
  // Read the deal count once the board has loaded its cards (it shows "0 deals" until then)
  const dealBtn = page.getByRole('button', { name: 'Deal', exact: true });
  await dealBtn.waitFor({ timeout: 30000 });
  await page.getByRole('heading', { level: 4 }).first().waitFor({ timeout: 30000 }).catch(() => {});
  const dealCount = page.getByText(/^\d+ deals$/).first();
  const countBefore = parseInt(await dealCount.innerText(), 10);

  // Open the Add deal form
  await dealBtn.click();
  const formHeading = page.getByRole('heading', { name: 'Add deal', level: 3 });
  await expect(formHeading, 'Add deal form should open').toBeVisible();

  // Contact person
  await page.getByRole('textbox', { name: 'Name' }).first().fill(deal.person);

  // Organization: type, then pick the first suggestion (existing org or "Add ... as new")
  const orgField = page.getByRole('textbox', { name: 'Name' }).nth(1);
  await orgField.click();
  await orgField.pressSequentially(deal.organization);
  await page.waitForTimeout(1000);
  await orgField.press('ArrowDown');
  await orgField.press('Enter');

  // Title should be auto-filled from person + organization
  const titleField = page.getByRole('textbox', { name: 'Deal title' });
  await expect(titleField, 'Deal title should auto-fill').not.toHaveValue('');
  const dealTitle = await titleField.inputValue();

  // Value
  await page.getByPlaceholder('0').fill(deal.value);

  // Phone and email
  const phoneInput = page.getByPlaceholder('Phone number');
  await phoneInput.scrollIntoViewIfNeeded();
  await phoneInput.fill(deal.phone);
  // Unique per run (name+timestamp@domain): the app rejects a second deal for the same email (409)
  const [user, domain] = deal.email.split('@');
  await page.getByPlaceholder('Email address').fill(`${user}+${Date.now()}@${domain}`);

  // Save and wait for the create API
  const [createResponse] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/deals/create') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Save' }).click(),
  ]);
  expect(createResponse.ok(), `Create deal API returned ${createResponse.status()}`).toBeTruthy();

  // Success message (soft so the remaining checks still run if it is missing)
  // (match "successfully" - plain "Deal created" is also the "Sort by" dropdown label)
  const successMsg = page.getByText(/successfully/i).first();
  if (checkSuccessMessage) {
    await expect.soft(successMsg, 'A success message should be shown after saving the deal').toBeVisible({ timeout: 5000 });
  }

  // UX checks: form closes, deal card shows up, count goes up
  await expect(formHeading, 'Add deal form should close after save').toBeHidden();
  await expect(page.getByRole('heading', { name: dealTitle, level: 4 }).first(), 'New deal card should be visible').toBeVisible();
  await expect(dealCount).toHaveText(`${countBefore + 1} deals`);

  await page.screenshot({ path: `screenshots/${deal.screenshot}` });
}

module.exports = { createDeal, addDeal, loginStaging };
