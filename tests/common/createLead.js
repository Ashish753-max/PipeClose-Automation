// tests/common/createLead.js
// Shared lead setup for the Lead scripts (tests/Lead Details/*.spec.js, tests/Lead/ArchiveDeleteLead.spec.js)
const { expect } = require('@playwright/test');
const { loginStaging } = require('./createDeal');

// "56 leads" above the Leads table ("1 leads" when there is one)
const leadCounter = page => page.getByText(/^\d+ leads?$/);

/** Number shown in the "N leads" counter. */
async function leadCount(page) {
  return parseInt(await leadCounter(page).innerText(), 10);
}

/** Logs in and opens the Leads list, waiting for its rows. */
async function openLeads(page) {
  await loginStaging(page);
  const leadsLink = page.locator('a[href="/leads"]').first();
  await leadsLink.waitFor({ timeout: 30000 });
  await Promise.all([page.waitForURL(/\/leads$/), leadsLink.click()]);
  await expect(leadCounter(page)).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('row').nth(1), 'Leads table should load').toBeVisible({ timeout: 30000 });
}

/**
 * Adds a lead with a unique name from the Leads list and waits for its row.
 * @param {import('@playwright/test').Page} page
 * @param {string} prefix person name prefix, e.g. "LeadDetail" gives "LeadDetail123456"
 * @returns {Promise<{ id: number, person: string, organization: string, title: string }>}
 */
async function addLead(page, prefix) {
  const stamp = Date.now().toString().slice(-6);
  const person = `${prefix}${stamp}`;
  const organization = `LeadOrg${stamp}`;

  await page.getByRole('button', { name: 'Lead', exact: true }).click();
  const formHeading = page.getByRole('heading', { name: 'Add lead', level: 3 });
  await expect(formHeading, 'Add lead form should open').toBeVisible();
  await page.getByRole('textbox', { name: 'Name' }).first().fill(person);
  const orgField = page.getByRole('textbox', { name: 'Name' }).nth(1);
  await orgField.click();
  await orgField.pressSequentially(organization);
  await page.getByRole('spinbutton', { name: 'Value' }).fill('2500');
  await page.getByPlaceholder('Phone number').fill('9876543210');
  // Unique per run so it never clashes with an existing deal's email
  await page.getByPlaceholder('Email address').fill(`lead.details+${Date.now()}@gmail.com`);

  const [response] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/leads/create') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Save', exact: true }).click(),
  ]);
  expect(response.ok(), `Create lead API returned ${response.status()}`).toBeTruthy();
  const { lead } = (await response.json()).data;
  await expect(formHeading, 'Add lead form should close after save').toBeHidden();
  // .first(): the list briefly showed a new lead twice once while other leads were being created
  await expect(page.getByRole('cell', { name: person, exact: true }).first(), 'New lead should be listed').toBeVisible();
  console.log(`Created lead ${lead.id} "${lead.title}"`);
  return { id: lead.id, person, organization, title: lead.title };
}

module.exports = { openLeads, addLead, leadCount };
