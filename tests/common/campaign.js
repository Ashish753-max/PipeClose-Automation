// tests/common/campaign.js
// Helpers for the Campaign scripts (tests/Campaign/*.spec.js)
const { expect } = require('@playwright/test');

// True when the response saves a change to a sequence (PATCH /api/sequences/<id>)
function isSequenceUpdate(response) {
  return /\/api\/sequences\/[^/]+$/.test(response.url()) && response.request().method() === 'PATCH';
}

// Opens Campaigns from the sidebar (right after login)
async function openCampaigns(page) {
  // Wait until login has landed on Deals: a sidebar click before that is lost
  await expect(page).toHaveURL(/\/deals/, { timeout: 30000 });
  await page.locator('a[href="/campaigns"]').first().click({ timeout: 30000 });
  await page.waitForURL('**/campaigns**');
}

// Opens a campaign with the switcher at the top of the page. Returns false if there is no campaign with that name.
async function openCampaign(page, name) {
  const heading = page.getByRole('main').getByRole('heading', { level: 2 }).first();
  await heading.waitFor({ timeout: 30000 });
  const openCampaignName = (await heading.innerText()).trim();
  if (openCampaignName === name) return true;

  await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('button').first().click();
  const option = page.getByRole('option', { name, exact: true });
  const found = await option.isVisible({ timeout: 5000 }).catch(() => false);
  if (!found) {
    await page.keyboard.press('Escape');
    return false;
  }
  await option.getByRole('button').click();
  await expect(heading).toHaveText(name);
  return true;
}

// A sequence's tab in the open campaign. The tab reads the name and then the state, e.g. "Test case 2 Paused",
// so it is matched as "the name followed by a space" (then "Test case 2" does not also match "Test case 20").
function sequenceTab(page, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // so the name is matched as plain text
  return page.getByRole('tablist', { name: 'Sequences' }).getByRole('tab', { name: new RegExp(`^${escapedName} `) });
}

// Selects a sequence of the open campaign and waits for its steps to load
async function openSequence(page, name) {
  const tab = sequenceTab(page, name);
  await tab.waitFor({ timeout: 30000 });
  const isSelected = (await tab.getAttribute('aria-selected')) === 'true';
  if (!isSelected) {
    await Promise.all([
      page.waitForResponse(res => /\/api\/sequences\/[^/]+\/steps$/.test(res.url()) && res.request().method() === 'GET'),
      tab.click(),
    ]);
  }
  await expect(page.getByRole('heading', { name, exact: true, level: 1 })).toBeVisible();
}

// Adds a sequence to the open campaign; the new sequence opens
async function createSequence(page, name) {
  await page.getByRole('button', { name: 'New sequence' }).click();
  const createButton = page.getByRole('dialog').getByRole('button', { name: 'Create' });
  await expect(createButton, 'Create should be disabled until a name is typed').toBeDisabled();
  await page.getByRole('textbox', { name: 'Sequence name' }).fill(name);
  const [response] = await Promise.all([
    page.waitForResponse(res => /\/sequences$/.test(res.url()) && res.request().method() === 'POST'),
    createButton.click(),
  ]);
  expect(response.status(), `Creating sequence "${name}" should succeed`).toBe(201);
  await expect(sequenceTab(page, name)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name, exact: true, level: 1 })).toBeVisible();
}

// Deletes the open sequence and its steps (the confirm question is shown on the page, not in a popup)
async function deleteSequence(page) {
  await page.getByRole('button', { name: 'Delete this sequence' }).click();
  await expect(page.getByText('Delete this sequence and its steps?')).toBeVisible();
  const [response] = await Promise.all([
    page.waitForResponse(res => /\/api\/sequences\/[^/]+$/.test(res.url()) && res.request().method() === 'DELETE'),
    page.getByRole('main').getByRole('button', { name: 'Delete', exact: true }).click(),
  ]);
  expect(response.ok(), `Deleting the sequence should succeed (got ${response.status()})`).toBe(true);
}

// Shows the Enrolled view of the open sequence and returns what it loaded: { enrollments, statusCounts }
async function openEnrolled(page) {
  const views = page.getByRole('tablist', { name: 'Sequence view' });
  const enrolledTab = views.getByRole('tab', { name: 'Enrolled' });
  // Clicking Enrolled while it is shown does not load it again, so go to Steps first
  if ((await enrolledTab.getAttribute('aria-selected')) === 'true') {
    await views.getByRole('tab', { name: 'Steps' }).click();
  }
  const [response] = await Promise.all([
    page.waitForResponse(res => /\/api\/sequences\/[^/]+\/enrollments\?limit=/.test(res.url())),
    enrolledTab.click(),
  ]);
  expect(response.status(), 'The enrollments should load').toBe(200);
  const body = await response.json();
  return body.data;
}

module.exports = {
  isSequenceUpdate, openCampaigns, openCampaign, sequenceTab, openSequence, createSequence, deleteSequence, openEnrolled,
};
