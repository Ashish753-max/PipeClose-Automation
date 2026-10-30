const { test, expect } = require('@playwright/test');
const { loginStaging, addDeal } = require('../common/createDeal');
const { openArchived } = require('../common/archiveDeal');

// "20 deals" above the list
const dealCount = async page => parseInt(await page.getByText(/^\d+ deals?$/).first().innerText(), 10);

async function openListView(page) {
  await page.getByRole('button', { name: 'List View', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'Title' })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('Loading deals...')).toBeHidden({ timeout: 30000 });
}

test("Archive a deal from the Action menu in List View", async ({ page }) => {
  test.setTimeout(180000);
  await loginStaging(page);
  await page.getByRole('button', { name: 'Pipeline View', exact: true }).click({ timeout: 30000 });

  // A fresh deal, so no real deal is ever archived
  const stamp = Date.now().toString().slice(-6);
  const created = page.waitForResponse(r => r.url().includes('/api/deals/create') && r.request().method() === 'POST');
  await addDeal(page, {
    person: `DealArchive${stamp}`, organization: `DealOrg${stamp}`, value: '1500',
    phone: '9876543210', email: 'deal.archive@gmail.com', screenshot: 'ArchiveDealFromList-created.png',
  }, { checkSuccessMessage: false });
  const { deal } = (await (await created).json()).data;

  await openListView(page);
  const row = page.getByRole('row').filter({ hasText: deal.title });
  await expect(row, 'New deal should be in the list').toHaveCount(1, { timeout: 30000 });
  const countBefore = await dealCount(page);

  // Three-dots menu in the Action column (the button has no label)
  await row.getByRole('cell').last().getByRole('button').click();
  const archive = page.getByRole('button', { name: 'Archive Deal', exact: true });
  await expect(archive, '"Archive Deal" should be in the menu').toBeVisible();
  const [response] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/api/deals/archive') && r.request().method() === 'POST'),
    archive.click(),
  ]);
  expect(response.ok(), `Archive API returned ${response.status()}`).toBeTruthy();
  expect(response.request().postDataJSON().dealIds, 'Only this deal should be archived').toEqual([deal.id]);

  // Success message, row leaves the list and the counter goes down by one
  await expect.soft(page.getByRole('heading', { name: 'Deal archived', exact: true }),
    'Success message "Deal archived" should be shown').toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: 'screenshots/ArchiveDealFromList-archived.png' });
  await expect(row, 'Archived deal should leave the list').toHaveCount(0);
  await expect.soft.poll(() => dealCount(page), { message: `Deal count should go from ${countBefore} to ${countBefore - 1}` })
    .toBe(countBefore - 1);
  console.log(`Archived deal ${deal.id} "${deal.title}"`);

  // Shown in the Archived section
  const archived = await openArchived(page);
  expect(archived.map(d => d.id), 'Deal should be in Archived').toContain(deal.id);
  const archivedRow = page.getByRole('row').filter({ hasText: deal.title });
  await expect(archivedRow, 'Deal should be listed in the Archived section').toHaveCount(1, { timeout: 30000 });
  await expect(archivedRow).toContainText('$1,500');
  await expect(archivedRow.getByRole('button', { name: /Unarchive/ })).toBeVisible();
  await page.screenshot({ path: 'screenshots/ArchiveDealFromList-in-archived.png' });
});
