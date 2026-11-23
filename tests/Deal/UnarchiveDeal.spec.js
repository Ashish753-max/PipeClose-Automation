const { test, expect } = require('@playwright/test');
const { loginStaging, addDeal } = require('../common/createDeal');
const { archiveDeal, openArchived } = require('../common/archiveDeal');

const BASE_URL = 'https://staging.pipeclose.com';

// Creates a fresh deal, archives it, then restores it with Unarchive in the Archived view and checks
// it is back on the Deals board as an open deal. Screenshots are saved in screenshots/Deal/.

// The test deal, archived again after the test (also when it fails or times out) so runs don't fill up the Deals list
let testDeal;
test.afterEach(async ({ page }) => {
  if (!testDeal) return;
  const response = await page.request.post(`${BASE_URL}/api/deals/archive`, { data: { dealIds: [testDeal.id] } }).catch(e => e);
  if (response.ok?.()) console.log(`Cleanup: archived deal ${testDeal.id}`);
  else console.warn(`Cleanup: could not archive deal ${testDeal.id} "${testDeal.title}": ${response.status?.() ?? response.message}`);
  testDeal = undefined;
});

test('Unarchive a deal from the Archived view', async ({ page }) => {
  test.setTimeout(300000);
  await loginStaging(page);
  await page.getByRole('button', { name: 'Pipeline View', exact: true }).click({ timeout: 30000 });

  // A fresh deal, so no real deal is ever archived. Names have no capitals inside words:
  // the deal page title-cases each word ("UnarchiveOrg" would show as "Unarchiveorg")
  const stamp = Date.now().toString().slice(-6);
  const organization = `Unarchiveorg${stamp}`;
  const created = page.waitForResponse(r => r.url().includes('/api/deals/create') && r.request().method() === 'POST');
  await addDeal(page, {
    person: `Unarchive${stamp}`, organization, value: '1800',
    phone: '9876543210', email: 'deal.unarchive@gmail.com', screenshot: 'Deal/UnarchiveDeal-1-created.png',
  }, { checkSuccessMessage: false });
  const { deal } = (await (await created).json()).data;
  testDeal = deal;
  console.log(`Created deal ${deal.id} "${deal.title}"`);

  // Archive it from its page (checks it leaves the board)
  await archiveDeal(page, deal);

  const card = page.getByRole('heading', { name: deal.title, exact: true, level: 4 });
  const archivedRow = page.getByRole('row').filter({ hasText: deal.title });

  await test.step('Archived deal is listed with an Unarchive button', async () => {
    const archived = await openArchived(page);
    expect(archived.map(d => d.id), 'Deal should be in Archived').toContain(deal.id);
    await expect(archivedRow, 'Deal should be listed in the Archived section').toHaveCount(1, { timeout: 30000 });
    await expect(archivedRow).toContainText('$1,800');
    await expect(archivedRow).toContainText(organization);
    await page.screenshot({ path: 'screenshots/Deal/UnarchiveDeal-2-in-archived.png' });
  });

  await test.step('Unarchive restores the deal straight away', async () => {
    // No confirmation is asked
    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith('/api/deals/unarchive') && r.request().method() === 'POST', { timeout: 30000 }),
      archivedRow.getByRole('button', { name: /Unarchive/ }).click(),
    ]);
    expect(response.ok(), `Unarchive API returned ${response.status()}`).toBeTruthy();
    expect(response.request().postDataJSON().dealIds, 'Only this deal should be unarchived').toEqual([deal.id]);

    await expect.soft(page.getByText(/unarchived/i).first(), 'A success message should be shown').toBeVisible({ timeout: 5000 });
    await expect(archivedRow, 'Deal should leave the Archived list').toHaveCount(0, { timeout: 15000 });
    // The app goes back to the board after Unarchive: wait for it to load before the screenshot
    await expect(page).toHaveURL(/\/deals$/);
    await expect(card, 'Unarchived deal should show on the board').toBeVisible({ timeout: 30000 });
    await card.first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'screenshots/Deal/UnarchiveDeal-3-unarchived.png' });
    console.log(`Unarchived deal ${deal.id}`);
  });

  await test.step('Deal is back on the board and open, also after a reload', async () => {
    await page.goto(`${BASE_URL}/deals`);
    await page.getByRole('button', { name: 'Pipeline View', exact: true }).click({ timeout: 30000 });
    await expect(card, 'Unarchived deal should be back on the board').toBeVisible({ timeout: 30000 });
    await page.reload();
    await page.getByRole('button', { name: 'Pipeline View', exact: true }).click({ timeout: 30000 });
    await expect(card, 'Unarchived deal should stay on the board after reload').toBeVisible({ timeout: 30000 });
    await page.screenshot({ path: 'screenshots/Deal/UnarchiveDeal-4-on-board.png' });

    // Opens normally, still open, with its data kept
    const [details] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith(`/api/deals/get/${deal.id}`) && r.request().method() === 'GET', { timeout: 30000 }),
      card.first().click(),
    ]);
    await expect(page).toHaveURL(`${BASE_URL}/deals/${deal.id}`);
    const stored = (await details.json()).data;
    expect(stored.status, 'Unarchived deal should be OPEN').toBe('OPEN');
    expect(stored.value, 'Deal value should be kept').toBe(1800);
    await expect(page.getByRole('button', { name: 'Won', exact: true }), 'Won/Lost should be available').toBeVisible({ timeout: 30000 });

    // Gone from Archived for good
    const archivedAfter = await openArchived(page);
    expect(archivedAfter.map(d => d.id), 'Deal should not be in Archived after reload').not.toContain(deal.id);
  });
});
