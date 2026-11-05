// tests/common/knowledgeBase.js
// Helpers for the AI Knowledge Base scripts (tests/KnowledgeBase/*.spec.js)
const { expect } = require('@playwright/test');
const { loginStaging } = require('./createDeal');

// The sections of the page.
//   category: each section is saved to its own category (PATCH /api/ai/kb/<category>)
//   confirm: the section asks "Save ... changes?" before saving
//   loadsOnOpen: what the section loads when it is opened (Sales Playbook loads the account's ICP)
const SECTIONS = {
  'Company Profile': { category: 1, confirm: true },
  'Products & Services': { category: 2, confirm: false },
  'Sales Playbook': { category: 3, confirm: false, loadsOnOpen: '/api/auth/icp-profile' },
  'Common Customer Objections': { category: 5, confirm: true },
  'Communication Preferences': { category: 6, confirm: true },
  'Portfolio': { category: 8, confirm: true },
};

// True when the response is the page loading the whole knowledge base
function isKnowledgeBaseLoad(response) {
  return response.url().endsWith('/api/ai/kb') && response.request().method() === 'GET';
}

// A section's header: its heading plus the "Needs attention" badge. Clicking it opens the section.
function sectionHeader(page, name) {
  const heading = page.getByRole('heading', { name, level: 3, exact: true });
  return page.getByRole('main').getByRole('button').filter({ has: heading });
}

// Logs in and opens AI Knowledge Base from the sidebar. Returns the knowledge base as the page loaded it.
async function openKnowledgeBase(page) {
  await loginStaging(page);
  // Wait until login has landed on Deals: a sidebar click before that is lost
  await expect(page).toHaveURL(/\/deals/, { timeout: 30000 });

  // The sidebar shows the link as an icon, so find it by its address. On a short screen (like the 720px high test
  // browser) the link is inside the sidebar's "More navigation options" menu instead.
  const link = page.locator('a[href="/ai-knowledge-base"]').filter({ visible: true }).first();
  const moreMenu = page.getByRole('button', { name: 'More navigation options' });
  await expect(link.or(moreMenu).first()).toBeVisible({ timeout: 30000 });
  if (await moreMenu.isVisible()) await moreMenu.click();

  const [response] = await Promise.all([
    page.waitForResponse(isKnowledgeBaseLoad),
    link.click(),
  ]);
  expect(response.status(), 'The knowledge base should load').toBe(200);
  await expect(page).toHaveURL(/\/ai-knowledge-base/);
  await expect(page.getByRole('heading', { name: 'AI Knowledge Base', level: 1 })).toBeVisible();
  for (const name of Object.keys(SECTIONS)) {
    await expect(sectionHeader(page, name), `${name} should be listed`).toBeVisible();
  }
  return response.json();
}

// Reloads the page and waits for the knowledge base to load again (all sections start closed)
async function reloadKnowledgeBase(page) {
  await Promise.all([
    page.waitForResponse(isKnowledgeBaseLoad),
    page.reload(),
  ]);
}

// Opens a section (only one is open at a time)
async function openSection(page, name) {
  const { loadsOnOpen } = SECTIONS[name];
  if (!loadsOnOpen) {
    await sectionHeader(page, name).click();
    return;
  }
  // Wait for what the section loads, or its fields are reset when it arrives
  const [response] = await Promise.all([
    page.waitForResponse(res => res.url().endsWith(loadsOnOpen) && res.request().method() === 'GET'),
    sectionHeader(page, name).click(),
  ]);
  expect(response.status(), `${name} should load`).toBe(200);
}

// Picks an option in a dropdown of the open section (the list opens below it, with a search box)
async function pickOption(page, dropdown, option) {
  // The list closes when the page scrolls, so scroll the dropdown to the middle of the screen before clicking it
  await dropdown.evaluate(element => element.scrollIntoView({ block: 'center' }));
  await dropdown.click();
  const item = page.getByRole('listitem').getByRole('button', { name: option, exact: true });
  await expect(item, `The list should show ${option}`).toBeVisible();
  await item.click();
  await expect(page.getByRole('main').getByRole('button', { name: option, exact: true }), `${option} should be picked`)
    .toBeVisible();
}

// Clicks a button that saves the open section, and returns the save response once the page has also reloaded the
// knowledge base. Wait for that reload before the next step: it redraws the section, which resets anything
// filled in or opened before it arrives.
async function clickAndWaitForSave(page, button, sectionName) {
  const { category } = SECTIONS[sectionName];
  const [saveResponse] = await Promise.all([
    page.waitForResponse(res => res.url().endsWith(`/api/ai/kb/${category}`) && res.request().method() === 'PATCH'),
    page.waitForResponse(isKnowledgeBaseLoad),
    page.waitForResponse(res => res.url().endsWith('/api/ai/kb/setup-attention')),
    button.click(),
  ]);
  return saveResponse;
}

// Empties the open section with its "Clear <section>" button and the confirm popup
async function clearSection(page, name) {
  await page.getByRole('main').getByRole('button', { name: `Clear ${name}`, exact: true }).click();

  // The confirm popup has no dialog role: find the smallest box with its title and a Cancel button
  const popup = page.locator('div')
    .filter({ has: page.getByRole('heading', { name: `Clear ${name}?`, exact: true }) })
    .filter({ has: page.getByRole('button', { name: 'Cancel', exact: true }) })
    .last();
  const confirmButton = popup.getByRole('button', { name: `Clear ${name}`, exact: true });
  const response = await clickAndWaitForSave(page, confirmButton, name);
  expect(response.status(), 'Clear should succeed').toBe(200);
  await expect(popup).toBeHidden();
}

// Saves the open section (confirming when it asks), checks the "<section> saved." message, and returns the
// knowledge base as saved
async function saveSection(page, name) {
  const { category, confirm } = SECTIONS[name];
  const saveButton = page.getByRole('main').getByRole('button', { name: 'Save Changes', exact: true });
  const confirmButton = page.getByRole('dialog', { name: `Save ${name} changes?` })
    .getByRole('button', { name: 'Save changes', exact: true });

  let response;
  if (confirm) {
    await saveButton.click();
    response = await clickAndWaitForSave(page, confirmButton, name);
  } else {
    response = await clickAndWaitForSave(page, saveButton, name);
  }
  expect(response.status(), 'Save should succeed').toBe(200);
  const body = await response.json();
  expect(body.message).toBe(`Category ${category} updated successfully`);
  await expect(confirmButton).toBeHidden();
  await expect(page.getByRole('main').getByText(`${name} saved.`, { exact: true })).toBeVisible();
  return body.kb;
}

module.exports = {
  openKnowledgeBase, reloadKnowledgeBase, openSection, sectionHeader, pickOption, clearSection, saveSection,
};
