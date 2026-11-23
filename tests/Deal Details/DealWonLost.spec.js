const { test, expect } = require('@playwright/test');
const { openNewDeal, reloadDeal, showDeals } = require('../common/dealDetails');

// Marks a new deal as Lost (with a reason) or Won from its details page, then checks the Deals board
// filter lists it under the right status only. Screenshots are saved in screenshots/DealWonLost/.
const LOST_REASON = 'Budget constraints';
const LOST_COMMENT = 'Client chose a cheaper competitor.';

/** Creates a deal, opens it and waits for the page to settle. */
async function openDeal(page) {
  await openNewDeal(page);
  await page.waitForTimeout(3000); // AI analysis re-renders the page when a deal is first opened
  const title = (await page.getByRole('heading', { level: 1 }).first().innerText()).trim();
  const id = Number(page.url().match(/\/deals\/(\d+)/)[1]);
  console.log(`Deal ${id}: "${title}"`);
  return { title, id };
}

/** Goes to the Deals board and checks the deal is listed under its status filter and no other. */
async function checkDealsFilter(page, deal, status, shot) {
  await page.locator('a[href="/deals"]').first().click();
  await expect(page).toHaveURL(/\/deals$/);
  await page.getByRole('heading', { level: 4 }).first().waitFor({ timeout: 30000 });
  const card = page.getByRole('heading', { name: deal.title, level: 4 });

  for (const filter of ['All lost deals', 'All won deals', 'All open deals']) {
    const ids = await showDeals(page, filter);
    if (filter === `All ${status} deals`) {
      expect(ids, `Deal should be in "${filter}"`).toContain(deal.id);
      await expect(card, `Deal card should show under "${filter}"`).toBeVisible();
      await shot(`filter-${status}`);
    } else {
      expect(ids, `Deal should not be in "${filter}"`).not.toContain(deal.id);
      await expect(card, `Deal card should not show under "${filter}"`).toHaveCount(0);
    }
  }
  // Ends on "All open deals", the board's normal view, so other tests see their new deals
}

test('Deal details - mark a deal as Lost with a reason and find it in the Lost deals filter', async ({ page }) => {
  test.setTimeout(300000);
  const shot = step => page.screenshot({ path: `screenshots/DealWonLost/lost-${step}.png` });
  const deal = await openDeal(page);
  const won = page.getByRole('button', { name: 'Won', exact: true });
  const lost = page.getByRole('button', { name: 'Lost', exact: true });
  const lostRequests = [];
  page.on('request', r => { if (r.url().includes('/api/deals/make-lost/')) lostRequests.push(r); });

  // Lost asks for a reason first
  await lost.click();
  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Mark deal as lost' }) });
  await expect(dialog).toBeVisible();
  const reason = dialog.getByPlaceholder('e.g. Budget constraints, competitor pricing');
  const comments = dialog.getByPlaceholder('Add any additional context...');
  const markLost = dialog.getByRole('button', { name: 'Mark as Lost' });
  await expect(markLost, 'Mark as Lost needs a reason').toBeDisabled();
  await reason.fill('   ');
  await expect(markLost, 'A reason of only spaces should not be accepted').toBeDisabled();
  await shot('1-reason-required');

  // Cancel leaves the deal open
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await expect(won).toBeVisible();
  await expect(lost).toBeVisible();
  expect(lostRequests, 'Cancel should not mark the deal as lost').toHaveLength(0);

  // Fill the reason and save
  await lost.click();
  await expect(dialog).toBeVisible();
  await expect.soft(reason, 'Cancel should discard what was typed (reopened dialog should start empty)').toHaveValue('');
  await reason.fill(LOST_REASON);
  await comments.fill(LOST_COMMENT);
  await expect(markLost).toBeEnabled();
  await shot('2-reason-filled');
  const [saved] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith(`/api/deals/make-lost/${deal.id}`), { timeout: 30000 }),
    markLost.click(),
  ]);
  expect(saved.ok(), `Mark as lost API returned ${saved.status()}`).toBeTruthy();
  expect(saved.request().postDataJSON()).toEqual({ reason: LOST_REASON, comments: LOST_COMMENT });
  await expect(dialog).toBeHidden();
  await expect(page.getByText(/^lost$/i).first(), 'Deal should show as LOST').toBeVisible();
  await expect(page.getByRole('button', { name: 'Reopen' })).toBeVisible();
  await expect(won, 'Won/Lost should be replaced by Reopen').toBeHidden();
  await expect(lost).toBeHidden();
  await shot('3-marked-lost');

  // The status and reason are kept after a reload
  const stored = await reloadDeal(page, deal.id);
  expect(stored.status).toBe('LOST');
  expect(stored.lostReason, 'Lost reason should be saved').toBe(LOST_REASON);
  expect.soft(JSON.stringify(stored), 'Lost comments should be saved with the deal').toContain(LOST_COMMENT);
  await expect(page.getByText(/^lost$/i).first(), 'Deal should still show as LOST after reload').toBeVisible();
  await expect(page.getByRole('button', { name: 'Reopen' })).toBeVisible();
  await shot('4-after-reload');

  await checkDealsFilter(page, deal, 'lost', shot);
});

test('Deal details - mark a deal as Won and find it in the Won deals filter', async ({ page }) => {
  test.setTimeout(300000);
  const shot = step => page.screenshot({ path: `screenshots/DealWonLost/won-${step}.png` });
  const deal = await openDeal(page);
  const won = page.getByRole('button', { name: 'Won', exact: true });
  const lost = page.getByRole('button', { name: 'Lost', exact: true });
  await shot('1-open');

  // Won saves straight away (no reason asked)
  const [saved] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith(`/api/deals/make-won/${deal.id}`), { timeout: 30000 }),
    won.click(),
  ]);
  expect(saved.ok(), `Mark as won API returned ${saved.status()}`).toBeTruthy();
  await expect(page.getByText(/^won$/i).first(), 'Deal should show as WON').toBeVisible();
  await expect(page.getByRole('button', { name: 'Reopen' })).toBeVisible();
  await expect(won, 'Won/Lost should be replaced by Reopen').toBeHidden();
  await expect(lost).toBeHidden();
  await shot('2-marked-won');

  // The status is kept after a reload
  const stored = await reloadDeal(page, deal.id);
  expect(stored.status).toBe('WON');
  await expect(page.getByText(/^won$/i).first(), 'Deal should still show as WON after reload').toBeVisible();
  await shot('3-after-reload');

  await checkDealsFilter(page, deal, 'won', shot);
});
