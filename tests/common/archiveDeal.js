// tests/common/archiveDeal.js
// Shared flow for the Archive and Delete Deal scripts (tests/Deal/ArchiveDeleteDeal*.spec.js)
const { expect } = require('@playwright/test');
const { addDeal, loginStaging } = require('./createDeal');

const BASE_URL = 'https://staging.pipeclose.com';
const isToday = date => new Date(date).toDateString() === new Date().toDateString();

// The Deals page reopens in the last used view (Pipeline or Archived), so pick the board explicitly
async function openBoard(page) {
  await page.getByRole('button', { name: 'Pipeline View', exact: true }).click({ timeout: 30000 });
  await expect(page.getByRole('heading', { level: 4 }).first()).toBeVisible({ timeout: 30000 });
}

/**
 * Logs in and returns the deals with this title that were created today, read from the
 * deal lists the page loads. Older deals with the same title are never returned.
 * When none is left on the board, one is created with `newDeal` so archiving is always tested.
 * Copies an earlier run archived but did not delete come back with `archived: true`.
 * @param {import('@playwright/test').Page} page
 * @param {string} title
 * @param {{ person: string, organization: string, value: string, phone: string, email: string, screenshot: string }} newDeal
 * @returns {Promise<{ id: number, title: string, archived: boolean }[]>}
 */
async function findTodaysDeals(page, title, newDeal) {
  const isMine = d => d.title === title && isToday(d.createdAt);
  const boardList = page.waitForResponse(
    r => r.url().includes('/api/deals/get?') && r.request().method() === 'GET', { timeout: 60000 });
  await loginStaging(page);
  const deals = (await (await boardList).json()).data.deals
    .filter(isMine)
    .map(d => ({ id: d.id, title: d.title, archived: false }));

  if (!deals.length) {
    await openBoard(page);
    const created = page.waitForResponse(
      r => r.url().includes('/api/deals/create') && r.request().method() === 'POST', { timeout: 120000 });
    await addDeal(page, newDeal, { checkSuccessMessage: false });
    const { deal } = (await (await created).json()).data;
    deals.push({ id: deal.id, title: deal.title, archived: false });
  }

  const leftovers = (await openArchived(page))
    .filter(isMine)
    .map(d => ({ id: d.id, title: d.title, archived: true }));
  console.log(`"${title}" created today: deal ${deals.map(d => d.id).join(', ')}`
    + (leftovers.length ? `; already archived: deal ${leftovers.map(d => d.id).join(', ')}` : ''));
  return [...deals, ...leftovers];
}

/**
 * Archives a deal from its page and verifies it leaves the Deals board.
 * @param {import('@playwright/test').Page} page
 * @param {{ id: number, title: string }} deal
 */
async function archiveDeal(page, deal) {
  // Cards with this title on the board (an older deal can share the title)
  await page.goto(`${BASE_URL}/deals`);
  await openBoard(page);
  const cards = page.getByRole('heading', { name: deal.title, exact: true, level: 4 });
  await expect(cards.first()).toBeVisible({ timeout: 30000 });
  const cardsBefore = await cards.count();

  await page.goto(`${BASE_URL}/deals/${deal.id}`);
  await expect(page.getByRole('heading', { name: deal.title, exact: true, level: 1 })).toBeVisible({ timeout: 30000 });

  // The menu button next to Won / Lost has no label; it is the last button of that group
  const header = page.getByRole('button', { name: 'Won', exact: true }).locator('xpath=../..');
  await header.getByRole('button').last().click();
  const [response] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/api/deals/archive') && r.request().method() === 'POST'),
    page.getByText('Archive Deal', { exact: true }).click(),
  ]);
  expect(response.ok(), `Archive API returned ${response.status()}`).toBeTruthy();

  // Toast shows for about a second before the page moves back to the board
  await expect.soft(page.getByRole('heading', { name: 'Deal archived', exact: true }),
    'Success message "Deal archived" should be shown').toBeVisible({ timeout: 5000 });

  // Back on the board: the card should go right away, and must be gone after a reload
  await expect(page).toHaveURL(/\/deals$/);
  await openBoard(page);
  await expect.soft(cards, 'Board should drop the archived deal right away')
    .toHaveCount(cardsBefore - 1, { timeout: 10000 });
  await page.reload();
  await openBoard(page);
  await expect(cards, 'Archived deal should leave the board').toHaveCount(cardsBefore - 1);
  console.log(`Archived deal ${deal.id}`);
}

/**
 * Opens the Archived view and returns the archived deals it loaded (same order as the table rows).
 * @param {import('@playwright/test').Page} page
 */
async function openArchived(page) {
  // Start from the board: clicking Archived while already there loads nothing
  await page.goto(`${BASE_URL}/deals`);
  await openBoard(page);
  const [list] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/deals/archived?') && r.request().method() === 'GET'),
    page.getByRole('button', { name: 'Archived', exact: true }).click(),
  ]);
  return (await list.json()).data.deals;
}

/**
 * Permanently deletes an archived deal from the Archived view and verifies it is gone.
 * @param {import('@playwright/test').Page} page
 * @param {{ id: number, title: string }} deal
 * @param {string} screenshot file name prefix in screenshots/
 */
async function deleteArchivedDeal(page, deal, screenshot) {
  const archived = await openArchived(page);
  const index = archived.findIndex(d => d.id === deal.id);
  expect(index, `"${deal.title}" should be listed in Archived`).toBeGreaterThanOrEqual(0);
  const row = page.getByRole('row').nth(index + 1); // first row is the header
  await expect(row).toContainText(deal.title);
  await expect(row).toContainText(new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
  const sameTitle = page.getByRole('row').filter({ hasText: deal.title });
  const rowsBefore = await sameTitle.count();

  // The delete icon next to Unarchive has no label; it asks for confirmation first
  await row.getByRole('button').last().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Permanently Delete Deal(s)?');
  await expect(dialog).toContainText(`Are you sure you want to delete "${deal.title}"?`);
  await expect(dialog).toContainText('This action is permanent and cannot be undone.');
  await page.screenshot({ path: `screenshots/${screenshot}-confirm.png` });

  const [response] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/deals/archived/permanent') && r.request().method() === 'DELETE'),
    dialog.getByRole('button', { name: 'Delete Forever', exact: true }).click(),
  ]);
  expect(response.ok(), `Delete API returned ${response.status()}`).toBeTruthy();

  await expect.soft(page.getByRole('heading', { name: 'Deal deleted', exact: true }),
    'Success message "Deal deleted" should be shown').toBeVisible({ timeout: 5000 });
  await expect.soft(page.getByText(`"${deal.title}" has been permanently deleted.`, { exact: true }),
    'Success message should name the deleted deal').toBeVisible({ timeout: 5000 });

  await expect(dialog).toBeHidden();
  await expect(sameTitle, 'Deleted deal should leave Archived').toHaveCount(rowsBefore - 1);
  await page.screenshot({ path: `screenshots/${screenshot}-deleted.png` });

  // Gone for good: not in Archived after reloading the page
  const archivedAfter = await openArchived(page);
  expect(archivedAfter.map(d => d.id), 'Deleted deal should not come back after reload').not.toContain(deal.id);
  console.log(`Deleted deal ${deal.id}`);
}

module.exports = { findTodaysDeals, archiveDeal, deleteArchivedDeal, openArchived };
