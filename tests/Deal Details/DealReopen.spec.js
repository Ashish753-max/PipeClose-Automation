const { test, expect } = require('@playwright/test');
const { openNewDeal, reloadDeal, showDeals } = require('../common/dealDetails');

// Marks a new deal as Won, reopens it, marks it as Lost, reopens it again, and checks each time that
// the deal is OPEN again: on its page, after a reload, and in the board's "All open deals" filter.
// Reopen asks for no confirmation. Screenshots are saved in screenshots/DealWonLost/.
const LOST_REASON = 'Budget constraints';

test('Deal details - reopen a Won deal and a Lost deal', async ({ page }) => {
  test.setTimeout(300000);
  const shot = step => page.screenshot({ path: `screenshots/DealWonLost/reopen-${step}.png` });

  await openNewDeal(page);
  await page.waitForTimeout(3000); // AI analysis re-renders the page when a deal is first opened
  const deal = {
    id: Number(page.url().match(/\/deals\/(\d+)/)[1]),
    title: (await page.getByRole('heading', { level: 1 }).first().innerText()).trim(),
  };
  console.log(`Deal ${deal.id}: "${deal.title}"`);

  const won = page.getByRole('button', { name: 'Won', exact: true });
  const lost = page.getByRole('button', { name: 'Lost', exact: true });
  const reopen = page.getByRole('button', { name: 'Reopen', exact: true });
  // The "WON" / "LOST" badge in the header (not the Won / Lost buttons, which have the same text)
  const statusBadge = status => page.getByText(new RegExp(`^${status}$`, 'i'))
    .locator('xpath=self::*[not(ancestor-or-self::button)]').first();

  /** Clicks Reopen and checks the deal is OPEN again, also after a reload. */
  async function reopenDeal(from) {
    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith(`/api/deals/re-open/${deal.id}`) && r.request().method() === 'PATCH',
        { timeout: 30000 }),
      reopen.click(),
    ]);
    expect(response.ok(), `Reopen API returned ${response.status()}`).toBeTruthy();
    expect((await response.json()).data.status, 'Reopen API should send the deal back as OPEN').toBe('OPEN');

    // Won / Lost come back in place of Reopen, and the status badge goes
    await expect(won, `Won should be back after reopening a ${from} deal`).toBeVisible();
    await expect(lost, `Lost should be back after reopening a ${from} deal`).toBeVisible();
    await expect(reopen, 'Reopen should be hidden once the deal is open').toBeHidden();
    await expect(statusBadge(from), `${from.toUpperCase()} badge should go`).toBeHidden();
    await shot(`${from}-2-reopened`);

    // Kept after a reload
    const stored = await reloadDeal(page, deal.id);
    expect(stored.status, `Deal should be OPEN after reopening a ${from} deal`).toBe('OPEN');
    // Noted, not failed: the app keeps these after Reopen (not decided yet whether that is wanted)
    if (stored.actualCloseDate) console.log(`Note: reopened ${from} deal keeps its close date ${stored.actualCloseDate}`);
    if (from === 'lost' && stored.lostReason) console.log(`Note: reopened lost deal keeps its lost reason "${stored.lostReason}"`);
    await expect(won, 'Won should still be shown after reload').toBeVisible({ timeout: 30000 });
    await expect(lost).toBeVisible();
    await expect(reopen).toBeHidden();
    console.log(`Reopened ${from} deal ${deal.id}`);
  }

  await test.step('Won deal can be reopened', async () => {
    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith(`/api/deals/make-won/${deal.id}`), { timeout: 30000 }),
      won.click(),
    ]);
    expect(response.ok(), `Mark as won API returned ${response.status()}`).toBeTruthy();
    await expect(statusBadge('won'), 'Deal should show as WON').toBeVisible();
    await expect(reopen).toBeVisible();
    await shot('won-1-marked');
    await reopenDeal('won');
  });

  await test.step('Lost deal can be reopened', async () => {
    await lost.click();
    const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Mark deal as lost' }) });
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder('e.g. Budget constraints, competitor pricing').fill(LOST_REASON);
    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith(`/api/deals/make-lost/${deal.id}`), { timeout: 30000 }),
      dialog.getByRole('button', { name: 'Mark as Lost' }).click(),
    ]);
    expect(response.ok(), `Mark as lost API returned ${response.status()}`).toBeTruthy();
    await expect(dialog).toBeHidden();
    await expect(statusBadge('lost'), 'Deal should show as LOST').toBeVisible();
    await expect(reopen).toBeVisible();
    await shot('lost-1-marked');
    await reopenDeal('lost');
  });

  await test.step('Reopened deal is listed under "All open deals" only', async () => {
    await page.locator('a[href="/deals"]').first().click();
    await expect(page).toHaveURL(/\/deals$/);
    await page.getByRole('button', { name: 'Pipeline View', exact: true }).click({ timeout: 30000 });
    await page.getByRole('heading', { level: 4 }).first().waitFor({ timeout: 30000 });
    const card = page.getByRole('heading', { name: deal.title, level: 4 });

    for (const filter of ['All won deals', 'All lost deals', 'All open deals']) {
      const ids = await showDeals(page, filter);
      if (filter === 'All open deals') {
        expect(ids, `Reopened deal should be in "${filter}"`).toContain(deal.id);
        await expect(card, 'Reopened deal card should be on the board').toBeVisible();
        await shot('3-in-open-deals');
      } else {
        expect(ids, `Reopened deal should not be in "${filter}"`).not.toContain(deal.id);
      }
    }
    // Ends on "All open deals", the board's normal view, so other tests see their new deals
  });
});
