// =====================================================================================================================
// TC_CAMPAIGN_09 - Filter campaigns by status: Draft
// =====================================================================================================================
// Purpose      : The Status filter on the Campaigns page shows "All" by default. Picking "Draft" shows exactly the
//                draft campaigns and hides every other one.
// Test data    : A campaign "QA Auto Filter Draft" is created for the test (a new campaign is a Draft, so the filter
//                must show it). The completed campaigns already in the account are campaigns the filter must hide
//                (staging needs at least one campaign that is not a Draft).
// Precondition : User can log in. A campaign with this name left by an earlier run is deleted first
//                (only this script uses this name).
//
// The filter runs in the browser, and the URL keeps the choice (/campaigns?status=DRAFT).
//
// Steps and expected results
//   1. Log in, open Campaigns and create the campaign "QA Auto Filter Draft"
//        -> It is listed with the status "Draft"
//   2. Look at the Status filter
//        -> It shows "All" by default, and the table lists campaigns of every status
//   3. Pick "Draft" in the Status filter
//        -> The URL is /campaigns?status=DRAFT
//        -> The table shows exactly the campaigns that are "Draft" in the full list, in the same order
//        -> Every row shown is "Draft", and the test campaign is one of them; no Completed campaign is shown
//   4. Reload the page
//        -> "Draft" is still picked, only drafts are shown, and the test campaign is still listed
//   5. Pick "All" again
//        -> The URL is /campaigns, and the full list is shown again (completed campaigns too)
//
// Cleanup      : The campaign is deleted at the end (also when the test fails).
// Screenshots  : screenshots/Campaign/FilterCampaignDraft-*.png
// =====================================================================================================================
const { test, expect } = require('@playwright/test');
const { loginStaging } = require('../common/createDeal');
const {
  openCampaigns, createCampaign, deleteCampaignIfExists, backToCampaigns, statusFilter, filterByStatus, campaignRows,
} = require('../common/campaign');

const CAMPAIGN = 'QA Auto Filter Draft';
const STATUS = 'Draft';

test.afterEach(async ({ page }) => {
  await deleteCampaignIfExists(page, CAMPAIGN);
});

test('TC_CAMPAIGN_09: Filter campaigns by status Draft', async ({ page }) => {
  const main = page.getByRole('main');

  // Step 1: A new campaign, which is a Draft
  await loginStaging(page);
  await openCampaigns(page);
  await deleteCampaignIfExists(page, CAMPAIGN);
  await backToCampaigns(page);
  await createCampaign(page, CAMPAIGN);
  await backToCampaigns(page);

  // Step 2: "All" by default, and the full list
  await expect(statusFilter(page), 'The Status filter should show "All" by default').toHaveValue('');
  await expect(statusFilter(page).locator('option:checked')).toHaveText('All');
  const allRows = await campaignRows(page);
  console.log(`All: ${allRows.length} campaigns`);
  expect(allRows, 'The new campaign should be listed as a Draft').toContainEqual({ name: CAMPAIGN, status: STATUS });
  const expected = allRows.filter(row => row.status === STATUS);
  expect(expected.length, 'The full list should also have campaigns that are not drafts, for the filter to hide')
    .toBeLessThan(allRows.length);
  await page.screenshot({ path: 'screenshots/Campaign/FilterCampaignDraft-1-all.png' });

  // Step 3: Draft shows exactly the draft campaigns
  await filterByStatus(page, STATUS);
  await expect.poll(() => campaignRows(page), { message: 'Only the draft campaigns should be shown, in list order' })
    .toEqual(expected);
  const shown = await campaignRows(page);
  for (const row of shown) {
    expect(row.status, `"${row.name}" is shown, so it should be a Draft`).toBe(STATUS);
  }
  expect(shown.map(row => row.name), 'The test campaign should be shown').toContain(CAMPAIGN);
  console.log(`Draft: ${shown.length} campaigns`);
  await page.screenshot({ path: 'screenshots/Campaign/FilterCampaignDraft-2-draft.png' });

  // Step 4: Still filtered after a reload (the list is loaded again, so only the statuses are compared)
  await page.reload();
  await expect(statusFilter(page), 'The filter should still be "Draft" after a reload').toHaveValue('DRAFT');
  await expect(main.getByRole('table')).toBeVisible({ timeout: 30000 });
  const afterReload = await campaignRows(page);
  for (const row of afterReload) {
    expect(row.status, `"${row.name}" is shown after the reload, so it should be a Draft`).toBe(STATUS);
  }
  expect(afterReload.map(row => row.name), 'The test campaign should still be shown after the reload')
    .toContain(CAMPAIGN);

  // Step 5: All shows every campaign again
  await filterByStatus(page, 'All');
  await expect.poll(async () => (await campaignRows(page)).length, { message: 'All should show campaigns of every status' })
    .toBeGreaterThan(afterReload.length);
  const backToAll = await campaignRows(page);
  expect(backToAll.some(row => row.status !== STATUS), 'Campaigns that are not drafts should be shown again')
    .toBe(true);
  await page.screenshot({ path: 'screenshots/Campaign/FilterCampaignDraft-3-back-to-all.png' });
});
