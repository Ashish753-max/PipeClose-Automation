// =====================================================================================================================
// TC_CAMPAIGN_08 - Filter campaigns by status: Completed
// =====================================================================================================================
// Purpose      : The Status filter on the Campaigns page shows "All" by default. Picking "Completed" shows exactly the
//                completed campaigns and hides every other one.
// Test data    : A campaign "QA Auto Filter Completed" is created for the test. A new campaign is a Draft, so it is
//                a campaign the Completed filter must hide. The completed campaigns already in the account are used
//                as they are (staging needs at least one).
// Precondition : User can log in. A campaign with this name left by an earlier run is deleted first
//                (only this script uses this name).
//
// The filter runs in the browser, and the URL keeps the choice (/campaigns?status=COMPLETED).
//
// Steps and expected results
//   1. Log in, open Campaigns and create the campaign "QA Auto Filter Completed"
//        -> It is listed with the status "Draft"
//   2. Look at the Status filter
//        -> It shows "All" by default, and the table lists campaigns of every status
//   3. Pick "Completed" in the Status filter
//        -> The URL is /campaigns?status=COMPLETED
//        -> The table shows exactly the campaigns that are "Completed" in the full list, in the same order
//        -> Every row shown is "Completed"; the Draft test campaign is not shown
//   4. Reload the page
//        -> "Completed" is still picked and only completed campaigns are shown
//   5. Pick "All" again
//        -> The URL is /campaigns, and the full list is shown again (the test campaign too)
//
// Cleanup      : The campaign is deleted at the end (also when the test fails).
// Screenshots  : screenshots/Campaign/FilterCampaignCompleted-*.png
// =====================================================================================================================
const { test, expect } = require('@playwright/test');
const { loginStaging } = require('../common/createDeal');
const {
  openCampaigns, createCampaign, deleteCampaignIfExists, backToCampaigns, statusFilter, filterByStatus, campaignRows,
} = require('../common/campaign');

const CAMPAIGN = 'QA Auto Filter Completed';
const STATUS = 'Completed';

test.afterEach(async ({ page }) => {
  await deleteCampaignIfExists(page, CAMPAIGN);
});

test('TC_CAMPAIGN_08: Filter campaigns by status Completed', async ({ page }) => {
  const main = page.getByRole('main');

  // Step 1: A Draft campaign, which the Completed filter must hide
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
  expect(allRows, 'The new campaign should be listed as a Draft').toContainEqual({ name: CAMPAIGN, status: 'Draft' });
  const expected = allRows.filter(row => row.status === STATUS);
  expect(expected.length, 'Staging should have at least one completed campaign to check the filter with')
    .toBeGreaterThan(0);
  expect(expected.length, 'The full list should also have campaigns that are not completed')
    .toBeLessThan(allRows.length);
  await page.screenshot({ path: 'screenshots/Campaign/FilterCampaignCompleted-1-all.png' });

  // Step 3: Completed shows exactly the completed campaigns
  await filterByStatus(page, STATUS);
  await expect.poll(() => campaignRows(page), { message: 'Only the completed campaigns should be shown, in list order' })
    .toEqual(expected);
  const shown = await campaignRows(page);
  for (const row of shown) {
    expect(row.status, `"${row.name}" is shown, so it should be Completed`).toBe(STATUS);
  }
  expect(shown.map(row => row.name), 'The Draft test campaign should be hidden').not.toContain(CAMPAIGN);
  console.log(`Completed: ${shown.length} campaigns`);
  await page.screenshot({ path: 'screenshots/Campaign/FilterCampaignCompleted-2-completed.png' });

  // Step 4: Still filtered after a reload (the list is loaded again, so only the statuses are compared)
  await page.reload();
  await expect(statusFilter(page), 'The filter should still be "Completed" after a reload').toHaveValue('COMPLETED');
  await expect(main.getByRole('table')).toBeVisible({ timeout: 30000 });
  const afterReload = await campaignRows(page);
  expect(afterReload.length, 'Completed campaigns should be shown after the reload').toBeGreaterThan(0);
  for (const row of afterReload) {
    expect(row.status, `"${row.name}" is shown after the reload, so it should be Completed`).toBe(STATUS);
  }

  // Step 5: All shows every campaign again
  await filterByStatus(page, 'All');
  await expect.poll(async () => (await campaignRows(page)).length, { message: 'All should show campaigns of every status' })
    .toBeGreaterThan(afterReload.length);
  const backToAll = await campaignRows(page);
  expect(backToAll, 'The Draft test campaign should be shown again').toContainEqual({ name: CAMPAIGN, status: 'Draft' });
  await page.screenshot({ path: 'screenshots/Campaign/FilterCampaignCompleted-3-back-to-all.png' });
});
