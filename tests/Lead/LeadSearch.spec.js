const { test, expect } = require('@playwright/test');
const { openLeads, addLead } = require('../common/createLead');

const BASE_URL = 'https://staging.pipeclose.com';

// The Leads list's own search box (the header also has a global "Search deals, leads, ..." box)
const searchBox = page => page.getByPlaceholder(/^Search leads/);
const clearButton = page => searchBox(page).locator('xpath=..').getByRole('button', { name: 'Clear search' });
// Table rows with data cells (the header row only has column headers)
const leadRows = page => page.getByRole('row').filter({ has: page.getByRole('cell') });
// "24 leads" next to the search box ("1 lead" when there is one)
const leadCounter = page => page.getByText(/^\d+ leads?$/);

/** Types the term in the Leads search box and returns what the list API sent back for it. */
async function searchLeads(page, term) {
  const [response] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/leads/get?') && new URL(r.url()).searchParams.get('search') === term,
      { timeout: 30000 }),
    searchBox(page).fill(term),
  ]);
  expect(response.ok(), `Lead search API returned ${response.status()}`).toBeTruthy();
  return (await response.json()).data;
}

/** Searches the term and checks that the list shows only the given lead. */
async function expectOnlyLead(page, term, lead, what) {
  const data = await searchLeads(page, term);
  expect(data.leads.map(l => l.id), `Searching the ${what} "${term}" should find only the new lead`).toEqual([lead.id]);
  await expect(leadCounter(page)).toHaveText('1 lead');
  await expect(leadRows(page)).toHaveCount(1);
  const row = leadRows(page).first();
  await expect(row.getByRole('cell', { name: lead.person, exact: true })).toBeVisible();
  await expect(row).toContainText(lead.organization);
  await expect(row).toContainText(lead.email);
  console.log(`Search by ${what} "${term}": found ${lead.person}`);
}

// The test lead, deleted after the test (also when it fails or times out) so runs don't fill up the Leads list
let testLead;
test.afterEach(async ({ page }) => {
  if (!testLead) return;
  // Moves it to the trash, like "Delete Lead" in the Action menu
  const response = await page.request.delete(`${BASE_URL}/api/leads/delete/${testLead.id}`).catch(e => e);
  if (response.ok?.()) console.log(`Cleanup: deleted lead ${testLead.id}`);
  else console.warn(`Cleanup: could not delete lead ${testLead.id} "${testLead.person}": ${response.status?.() ?? response.message}`);
  testLead = undefined;
});

test("Search leads in the Leads list", async ({ page }) => {
  test.setTimeout(240000);
  await openLeads(page);

  // A fresh lead with unique names, so every search has exactly one known result.
  // "LeadSearch Test123456" is saved as first name "LeadSearch", last name "Test123456".
  const lead = await addLead(page, 'LeadSearch Test');
  testLead = lead;
  const stamp = lead.person.match(/\d+$/)[0];
  const lastName = `Test${stamp}`;

  await test.step('Search box is shown empty', async () => {
    await expect(searchBox(page)).toBeVisible();
    await expect(searchBox(page)).toHaveValue('');
    await expect(clearButton(page), 'Clear button should only show once something is typed').toBeHidden();
  });

  await test.step('Search by contact name', async () => {
    await expectOnlyLead(page, lastName, lead, 'contact name');
    await expect(clearButton(page), 'Clear button should show while searching').toBeVisible();
    await page.screenshot({ path: 'screenshots/Lead/LeadSearch-1-contact.png' });
  });

  await test.step('Search by part of the name, in lower case', async () => {
    await expectOnlyLead(page, `st${stamp}`.toLowerCase(), lead, 'part of the contact name');
  });

  await test.step('Search by organization, in upper case', async () => {
    await expectOnlyLead(page, lead.organization.toUpperCase(), lead, 'organization');
    await page.screenshot({ path: 'screenshots/Lead/LeadSearch-2-organization.png' });
  });

  await test.step('Search by email', async () => {
    await expectOnlyLead(page, lead.email, lead, 'email');
    await page.screenshot({ path: 'screenshots/Lead/LeadSearch-3-email.png' });
  });

  await test.step('Search by full contact name, as shown in the list', async () => {
    // Soft check: the rest of the test still runs if the full name is not found
    const data = await searchLeads(page, lead.person);
    expect.soft(data.leads.map(l => l.id),
      `Searching the full contact name "${lead.person}", as shown in the CONTACT column, should find the lead`).toEqual([lead.id]);
    await page.screenshot({ path: 'screenshots/Lead/LeadSearch-4-full-name.png' });
  });

  await test.step('Search with no match shows "No leads found."', async () => {
    const term = `NoSuchLead${stamp}`;
    const data = await searchLeads(page, term);
    expect(data.leads, `Searching "${term}" should find nothing`).toEqual([]);
    await expect(page.getByText('No leads found.', { exact: true })).toBeVisible();
    await expect(leadCounter(page)).toHaveText('0 leads');
    await expect(leadRows(page)).toHaveCount(0);
    await page.screenshot({ path: 'screenshots/Lead/LeadSearch-5-no-match.png' });
  });

  await test.step('Clear search shows all leads again', async () => {
    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/leads/get?') && !new URL(r.url()).searchParams.has('search')),
      clearButton(page).click(),
    ]);
    expect(response.ok(), `Lead list API returned ${response.status()}`).toBeTruthy();
    const { leads, pagination } = (await response.json()).data;
    await expect(searchBox(page)).toHaveValue('');
    await expect(clearButton(page)).toBeHidden();
    await expect(page.getByText('No leads found.', { exact: true })).toBeHidden();
    await expect(leadCounter(page), 'Counter should show all leads again').toHaveText(`${pagination.total} leads`);
    await expect(leadRows(page)).toHaveCount(leads.length);
    expect(leads.length, 'All leads should be listed, not just the searched one').toBeGreaterThan(1);
    // Newest first, so the new lead is on the first page
    await expect(page.getByRole('cell', { name: lead.person, exact: true })).toBeVisible();
    console.log(`Cleared search: ${pagination.total} leads listed again`);
    await page.screenshot({ path: 'screenshots/Lead/LeadSearch-6-cleared.png' });
  });
});
