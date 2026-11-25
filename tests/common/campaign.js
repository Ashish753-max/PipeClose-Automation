// tests/common/campaign.js
// Helpers for the Campaign scripts (tests/Campaign/*.spec.js)
//
// Campaigns page: a table of campaigns; a campaign opens on its own page (/campaigns/<id>) with the tabs
// Analytics, Leads, Sequence, Schedule and Settings. A campaign has one sequence. To send, the campaign needs a
// sending account (Settings tab) and the sequence needs an email step with a body; then "Activate sequence".
const { expect } = require('@playwright/test');

const BASE_URL = 'https://staging.pipeclose.com';

// True when the response saves a change to a sequence (PATCH /api/sequences/<id>)
function isSequenceUpdate(response) {
  return /\/api\/sequences\/[^/]+$/.test(response.url()) && response.request().method() === 'PATCH';
}

// Opens Campaigns from the sidebar (right after login) and waits for the campaigns table
async function openCampaigns(page) {
  // Wait until login has landed on Deals: a sidebar click before that is lost
  await expect(page).toHaveURL(/\/deals/, { timeout: 30000 });
  await page.locator('a[href="/campaigns"]').first().click({ timeout: 30000 });
  await page.waitForURL(/\/campaigns$/);
  await expect(page.getByRole('main').getByRole('table')).toBeVisible({ timeout: 30000 });
}

// The open campaign's tabs: Analytics, Leads, Sequence, Schedule, Settings
function campaignTabs(page) {
  return page.getByRole('tablist', { name: 'Campaign sections' });
}

// Opens a campaign from the campaigns table. Returns false if there is no campaign with that name.
async function openCampaign(page, name) {
  if (!/\/campaigns$/.test(page.url())) {
    await page.goto(`${BASE_URL}/campaigns`);
  }
  const main = page.getByRole('main');
  await expect(main.getByRole('table')).toBeVisible({ timeout: 30000 });
  const link = main.getByRole('link', { name, exact: true });
  if (!(await link.first().isVisible({ timeout: 5000 }).catch(() => false))) return false;
  await link.first().click();
  await expect(campaignTabs(page)).toBeVisible({ timeout: 30000 });
  await expect(main.getByRole('heading', { name, exact: true, level: 2 })).toBeVisible();
  return true;
}

// Shows one of the campaign's tabs
async function openSection(page, name) {
  const tab = campaignTabs(page).getByRole('tab', { name, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

// Creates a campaign from the campaigns page; the new campaign opens. Returns its id.
async function createCampaign(page, name) {
  await page.getByRole('main').getByRole('button', { name: 'New campaign' }).click();
  const dialog = page.getByRole('dialog');
  const createButton = dialog.getByRole('button', { name: 'Create' });
  await expect(createButton, 'Create should be disabled until a name is typed').toBeDisabled();
  await dialog.getByRole('textbox', { name: 'Campaign name' }).fill(name);
  const [response] = await Promise.all([
    page.waitForResponse(res => res.url().endsWith('/api/campaigns') && res.request().method() === 'POST'),
    createButton.click(),
  ]);
  expect(response.status(), `Creating campaign "${name}" should succeed`).toBe(201);
  await expect(campaignTabs(page)).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('main').getByRole('heading', { name, exact: true, level: 2 })).toBeVisible();
  const body = await response.json();
  return body.data?.id ?? body.data?.campaign?.id ?? page.url().split('/').pop();
}

// Deletes the open campaign with "Campaign actions" > "Delete campaign" (it asks to confirm)
async function deleteCampaign(page) {
  const main = page.getByRole('main');
  const name = (await main.getByRole('heading', { level: 2 }).first().innerText()).trim();
  await main.getByRole('button', { name: 'Campaign actions' }).first().click();
  await page.getByRole('button', { name: 'Delete campaign' }).click();
  const dialog = page.getByRole('dialog').filter({ hasText: `Delete ${name} and all its sequences?` });
  await expect(dialog).toBeVisible();
  const [response] = await Promise.all([
    page.waitForResponse(res => /\/api\/campaigns\/[^/]+$/.test(res.url()) && res.request().method() === 'DELETE'),
    dialog.getByRole('button', { name: 'Delete', exact: true }).click(),
  ]);
  expect(response.ok(), `Deleting campaign "${name}" should succeed (got ${response.status()})`).toBe(true);
  console.log(`Deleted campaign "${name}"`);
}

// Deletes every campaign with this name (left by earlier runs), so a test can start with a new one
async function deleteCampaignIfExists(page, name) {
  while (await openCampaign(page, name)) {
    await deleteCampaign(page);
    await page.goto(`${BASE_URL}/campaigns`);
  }
}

// Creates the campaign's sequence from the Sequence tab ("No sequence in this campaign yet" > "Create sequence")
async function createSequence(page, name) {
  await openSection(page, 'Sequence');
  const main = page.getByRole('main');
  await expect(main.getByText('No sequence in this campaign yet')).toBeVisible({ timeout: 30000 });
  await main.getByRole('button', { name: 'Create sequence' }).click();
  const dialog = page.getByRole('dialog');
  const createButton = dialog.getByRole('button', { name: 'Create' });
  await expect(createButton, 'Create should be disabled until a name is typed').toBeDisabled();
  await dialog.getByRole('textbox', { name: 'Sequence name' }).fill(name);
  const [response] = await Promise.all([
    page.waitForResponse(res => /\/api\/campaigns\/[^/]+\/sequences$/.test(res.url()) && res.request().method() === 'POST'),
    createButton.click(),
  ]);
  expect(response.status(), `Creating sequence "${name}" should succeed`).toBe(201);
  await expect(main.getByRole('heading', { name, exact: true, level: 1 })).toBeVisible();
  await expect(main.getByText('Paused — not sending')).toBeVisible();
  await expect(main.getByRole('button', { name: 'Activate sequence' }), 'Cannot activate without a step').toBeDisabled();
  await expect(main.getByRole('button', { name: 'Create sequence' }), 'A campaign has one sequence').toHaveCount(0);
}

// Settings tab: sends from this account only, and saves the settings
async function chooseSendingAccount(page, sender) {
  await openSection(page, 'Settings');
  const accounts = page.getByRole('group', { name: 'Sending accounts' });
  await expect(accounts.getByRole('checkbox').first()).toBeVisible({ timeout: 30000 });
  for (const checkbox of await accounts.getByRole('checkbox').all()) {
    const label = await checkbox.getAttribute('aria-label') ?? await checkbox.evaluate(el => el.labels?.[0]?.innerText ?? '');
    if (label.trim() === sender) await checkbox.check();
    else await checkbox.uncheck();
  }
  await expect(accounts.getByText(`in this order: ${sender}.`)).toBeVisible();
  const [response] = await Promise.all([
    page.waitForResponse(res => /\/api\/campaigns\/[^/]+\/settings$/.test(res.url()) && res.request().method() !== 'GET'),
    page.getByRole('button', { name: 'Save settings' }).click(),
  ]);
  expect(response.ok(), `Saving the sending account should succeed (got ${response.status()})`).toBe(true);
  expect(JSON.stringify(response.request().postDataJSON()), 'The sending account should be saved').toContain(sender);
}

// Sequence tab: activates the sequence; it starts "Sending"
async function activateSequence(page) {
  await openSection(page, 'Sequence');
  const main = page.getByRole('main');
  const activate = main.getByRole('button', { name: 'Activate sequence' });
  await expect(activate, 'Activate should be enabled once there is a sending account and an email step with a body')
    .toBeEnabled({ timeout: 30000 });
  await Promise.all([
    page.waitForResponse(res => isSequenceUpdate(res) && (res.request().postData() || '').includes('isActive')),
    activate.click(),
  ]);
  await expect(main.getByRole('button', { name: 'Pause sequence' })).toBeVisible();
  await expect(main.getByText('Sending', { exact: true })).toBeVisible();
  await expect(main.getByText('1 sequence · 1 sending')).toBeVisible();
}

// Shows the Leads tab (the enrolled leads) and returns what it loaded: { enrollments, statusCounts }
async function openEnrolled(page) {
  const leadsTab = campaignTabs(page).getByRole('tab', { name: 'Leads', exact: true });
  // Clicking Leads while it is shown does not load it again, so go to Sequence first
  if ((await leadsTab.getAttribute('aria-selected')) === 'true') {
    await campaignTabs(page).getByRole('tab', { name: 'Sequence', exact: true }).click();
  }
  const [response] = await Promise.all([
    page.waitForResponse(res => /\/api\/sequences\/[^/]+\/enrollments\?limit=/.test(res.url())),
    leadsTab.click(),
  ]);
  expect(response.status(), 'The enrollments should load').toBe(200);
  const body = await response.json();
  return body.data;
}

// The box to type the campaign's new name in, once "Rename campaign" is clicked
function renameBox(page) {
  return page.getByRole('dialog').getByRole('textbox')
    .or(page.getByRole('main').getByRole('textbox', { name: /name/i })).first();
}

/**
 * Renames the open campaign with "Campaign actions" > "Rename campaign".
 * Returns the request that saved it (PATCH or PUT /api/campaigns/<id>).
 */
async function renameCampaign(page, newName) {
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Campaign actions' }).first().click();
  await page.getByRole('button', { name: 'Rename campaign' }).click();
  const box = renameBox(page);
  await expect(box, 'Rename should show a box with the current name').toBeVisible();
  await box.fill(newName);
  const save = page.getByRole('dialog').getByRole('button', { name: /^(Save|Rename)/ });
  const [response] = await Promise.all([
    page.waitForResponse(res => /\/api\/campaigns\/[^/]+$/.test(res.url()) && ['PATCH', 'PUT'].includes(res.request().method())),
    (await save.count()) ? save.first().click() : box.press('Enter'),
  ]);
  expect(response.ok(), `Renaming to "${newName}" should succeed (got ${response.status()})`).toBe(true);
  await expect(main.getByRole('heading', { name: newName, exact: true, level: 2 })).toBeVisible();
  return response;
}

// Sequence tab: deletes the campaign's sequence with "Delete this sequence" and confirms
async function deleteSequence(page) {
  await openSection(page, 'Sequence');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Delete this sequence' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog, 'Deleting a sequence should ask to confirm').toBeVisible();
  const [response] = await Promise.all([
    page.waitForResponse(res => /\/api\/sequences\/[^/]+$/.test(res.url()) && res.request().method() === 'DELETE'),
    dialog.getByRole('button', { name: /^Delete/ }).last().click(),
  ]);
  expect(response.ok(), `Deleting the sequence should succeed (got ${response.status()})`).toBe(true);
  await expect(main.getByText('No sequence in this campaign yet')).toBeVisible({ timeout: 30000 });
}

// The campaign names in the campaigns table
async function campaignNames(page) {
  const main = page.getByRole('main');
  await expect(main.getByRole('table')).toBeVisible({ timeout: 30000 });
  return (await main.getByRole('table').getByRole('link').allInnerTexts()).map(name => name.trim());
}

// The "Search campaigns" box above the campaigns table (it filters the table as you type, in the browser)
function campaignSearchBox(page) {
  return page.getByRole('main').getByRole('textbox', { name: 'Search campaigns' });
}

// The campaign names the table shows now; [] when nothing matches ("No campaign matches." and no table)
async function shownCampaignNames(page) {
  const table = page.getByRole('main').getByRole('table');
  if (!(await table.count())) return [];
  return (await table.getByRole('link').allInnerTexts()).map(name => name.trim());
}

// The "Status" filter above the campaigns table (All, Active, Paused, Draft, Completed, Error, Archived)
function statusFilter(page) {
  return page.getByRole('main').getByRole('combobox', { name: 'Status' });
}

/**
 * Picks a status in the Status filter (e.g. 'Completed', or 'All' for no filter). The table is filtered in the
 * browser, and the URL keeps the choice (?status=COMPLETED; no status for All).
 */
async function filterByStatus(page, label) {
  const value = label === 'All' ? '' : label.toUpperCase();
  await statusFilter(page).selectOption({ label });
  await expect(statusFilter(page), `The Status filter should show "${label}"`).toHaveValue(value);
  if (value) await expect(page).toHaveURL(new RegExp(`/campaigns\\?status=${value}$`));
  else await expect(page).toHaveURL(/\/campaigns$/);
}

// The rows the campaigns table shows now, as [{ name, status }]; [] when nothing matches (no table)
async function campaignRows(page) {
  const table = page.getByRole('main').getByRole('table');
  if (!(await table.count())) return [];
  return table.getByRole('row').evaluateAll(rows => rows
    .filter(row => row.querySelector('a'))
    .map(row => ({ name: row.cells[0].innerText.trim(), status: row.cells[1].innerText.trim() })));
}

// Goes back to the campaigns table and waits for it
async function backToCampaigns(page) {
  await page.goto(`${BASE_URL}/campaigns`);
  await expect(page.getByRole('main').getByRole('table')).toBeVisible({ timeout: 30000 });
}

// The steps of the open sequence
function sequenceSteps(page) {
  return page.getByRole('list', { name: 'Sequence steps' }).getByRole('listitem');
}

// Sequence tab: "Email" adds a step called "New step"; fills in its subject and body, and saves it
async function addEmailStep(page, subject, body) {
  await openSection(page, 'Sequence');
  const main = page.getByRole('main');
  const [addResponse] = await Promise.all([
    page.waitForResponse(res => /\/api\/sequences\/[^/]+\/steps$/.test(res.url()) && res.request().method() === 'POST'),
    main.getByRole('button', { name: 'Email', exact: true }).click(),
  ]);
  expect(addResponse.ok(), 'Adding the email step should succeed').toBe(true);

  const subjectField = page.getByRole('textbox', { name: 'Subject' });
  await expect(subjectField).toHaveValue('New step');
  await subjectField.fill(subject);
  await page.getByRole('textbox', { name: 'Body' }).fill(body);
  const [saveResponse] = await Promise.all([
    page.waitForResponse(res => /\/steps\/[^/]+$/.test(res.url()) && res.request().method() === 'PATCH'),
    page.getByRole('button', { name: 'Save step' }).click(),
  ]);
  expect(saveResponse.ok(), 'Saving the email step should succeed').toBe(true);
  expect(saveResponse.request().postDataJSON(), 'The subject and body should be saved as typed')
    .toMatchObject({ subject, body });
  await expect(sequenceSteps(page)).toHaveCount(1);
  await expect(sequenceSteps(page).first()).toContainText(`Step 1: ${subject}`);
  // Close the editor if it is still open
  const close = main.getByRole('button', { name: 'Close', exact: true });
  if (await close.isVisible()) await close.click();
}

// Types a name in the Enroll leads dialog's search box and returns the leads found
async function searchLeadsToEnroll(page, name) {
  const searchBox = page.getByRole('dialog').getByRole('textbox', { name: 'Search leads by name' });
  const [response] = await Promise.all([
    page.waitForResponse(res => res.url().includes('/api/leads/get?')
      && new URL(res.url()).searchParams.get('search') === name),
    searchBox.fill(name),
  ]);
  return (await response.json()).data?.leads ?? [];
}

/**
 * Leads tab > "Enroll leads": searches each name and picks the first lead found that is not picked yet.
 * Returns the picked leads: [{ id, title, firstName, email }]
 */
async function pickLeadsToEnroll(page, sequenceName, names) {
  await openEnrolled(page);
  await page.getByRole('main').getByRole('button', { name: 'Enroll leads' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(`into ${sequenceName}`, { exact: true })).toBeVisible();
  const chosenList = dialog.getByRole('list', { name: 'Leads to enroll' });

  const picked = [];
  for (const name of names) {
    const leads = await searchLeadsToEnroll(page, name);
    const lead = leads.find(found => !picked.some(pickedLead => pickedLead.id === found.id));
    if (!lead) {
      console.log(`No lead to pick for "${name}"`);
      continue;
    }
    await dialog.locator('div.cursor-pointer').filter({ has: page.getByText(lead.title, { exact: true }) }).first().click();
    await expect(chosenList.getByText(lead.title, { exact: true }), `${lead.title} should be picked`).toBeVisible();
    picked.push({ id: lead.id, title: lead.title, firstName: lead.person?.firstName, email: lead.person?.emails?.[0]?.email });
  }
  console.log('Picked leads:', picked.map(lead => `${lead.title} <${lead.email}>`));
  return picked;
}

/**
 * Clicks "Enroll N" in the Enroll leads dialog. Leads that cannot get the emails (e.g. unsubscribed or not
 * verified) are skipped by the app with a reason. Returns { enrolled, skipped }.
 */
async function enrollPickedLeads(page, pickedLeads) {
  const enrollButton = page.getByRole('dialog').getByRole('button', { name: `Enroll ${pickedLeads.length}`, exact: true });
  await expect(enrollButton).toBeEnabled();
  const [response] = await Promise.all([
    page.waitForResponse(res => /enroll/i.test(res.url()) && res.request().method() === 'POST', { timeout: 60000 }),
    enrollButton.click(),
  ]);
  expect(response.status(), 'Enrolling should succeed').toBe(201);
  const { enrolledLeadIds = [], skipped = [] } = (await response.json()).data;
  const enrolled = pickedLeads.filter(lead => enrolledLeadIds.includes(lead.id));
  console.log('Enrolled:', enrolled.map(lead => lead.title));
  console.log('Skipped:', skipped.map(item => `${pickedLeads.find(lead => lead.id === item.leadId)?.title ?? item.leadId} (${item.reason})`));
  expect(enrolled.length + skipped.length, 'Every picked lead is enrolled or skipped with a reason').toBe(pickedLeads.length);
  return { enrolled, skipped };
}

module.exports = {
  BASE_URL, isSequenceUpdate, openCampaigns, campaignTabs, openCampaign, openSection, createCampaign, deleteCampaign,
  deleteCampaignIfExists, createSequence, chooseSendingAccount, activateSequence, openEnrolled, campaignNames,
  backToCampaigns, sequenceSteps, addEmailStep, searchLeadsToEnroll, pickLeadsToEnroll, enrollPickedLeads,
  renameBox, renameCampaign, deleteSequence, campaignSearchBox, shownCampaignNames,
  statusFilter, filterByStatus, campaignRows,
};
