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

module.exports = {
  BASE_URL, isSequenceUpdate, openCampaigns, campaignTabs, openCampaign, openSection, createCampaign, deleteCampaign,
  deleteCampaignIfExists, createSequence, chooseSendingAccount, activateSequence, openEnrolled,
};
