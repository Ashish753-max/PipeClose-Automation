// tests/common/archiveLead.js
// Shared flow for the archived-lead scripts (tests/Lead/UnarchiveLead.spec.js, tests/Lead/DeleteArchivedLead.spec.js)
const { expect } = require('@playwright/test');
const { leadCount } = require('./createLead');

const BASE_URL = 'https://staging.pipeclose.com';

/** Row of the Leads table (List View or Archived) for this person. */
const leadRow = (page, person) => page.getByRole('row').filter({ has: page.getByRole('cell', { name: person, exact: true }) });

/** Opens the three-dots menu in the Action column of the lead's row (the button has no label). */
async function openRowMenu(page, person) {
  await leadRow(page, person).getByRole('cell').last().getByRole('button').click();
}

/**
 * Archives a lead from the Action menu of the Leads List View and checks it leaves the list.
 * @param {import('@playwright/test').Page} page
 * @param {{ id: number, person: string }} lead
 */
async function archiveLead(page, lead) {
  await openRowMenu(page, lead.person);
  const [response] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/api/leads/archive') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Archive Lead', exact: true }).click(),
  ]);
  expect(response.ok(), `Archive API returned ${response.status()}`).toBeTruthy();
  await expect(leadRow(page, lead.person), 'Archived lead should leave the List View').toHaveCount(0);
  console.log(`Archived lead ${lead.id}`);
}

/**
 * Opens the Archived view from the List View and returns the archived leads it loaded.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{ id: number, title: string }[]>}
 */
async function openArchivedLeads(page) {
  const [list] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/leads/archived?') && r.request().method() === 'GET', { timeout: 30000 }),
    page.getByRole('button', { name: 'Archived', exact: true }).click(),
  ]);
  await expect(page.getByText(/^\d+ leads?$/)).toBeVisible({ timeout: 30000 });
  return (await list.json()).data.leads;
}

/** Goes back to the Leads List View and waits for its rows. */
async function openListView(page) {
  await page.getByRole('button', { name: 'List View', exact: true }).click();
  await expect(page.getByRole('row').nth(1), 'Leads table should load').toBeVisible({ timeout: 30000 });
}

/** Reloads /leads in the List View (the page can reopen in the last used view). */
async function reloadListView(page) {
  await page.goto(`${BASE_URL}/leads`);
  await openListView(page);
  await expect(page.getByText(/^\d+ leads?$/)).toBeVisible({ timeout: 30000 });
}

/**
 * Cleanup through the API (also after a failed test): archives the lead, then deletes it forever,
 * so test leads never pile up in the Leads list or in Archived. Errors are only logged.
 * @param {import('@playwright/test').Page} page
 * @param {number} id
 */
async function removeLeadForever(page, id) {
  const archive = await page.request.post(`${BASE_URL}/api/leads/archive`, { data: { leadIds: [id] } }).catch(e => e);
  const remove = await page.request.delete(`${BASE_URL}/api/leads/archived/permanent`, { data: { leadIds: [id] } }).catch(e => e);
  if (remove.ok?.()) console.log(`Cleanup: deleted lead ${id}`);
  else console.warn(`Cleanup: could not delete lead ${id} (archive ${archive.status?.() ?? archive.message}, delete ${remove.status?.() ?? remove.message})`);
}

module.exports = { leadRow, openRowMenu, archiveLead, openArchivedLeads, openListView, reloadListView, removeLeadForever, leadCount };
