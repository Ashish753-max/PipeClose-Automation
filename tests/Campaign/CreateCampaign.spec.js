// =====================================================================================================================
// TC_CAMPAIGN_01 - Create a campaign successfully
// =====================================================================================================================
// Purpose      : A user can create a new campaign from the Campaigns page, and it is saved and listed.
// Test data    : Campaign name "QA Auto - Create campaign"
// Precondition : User can log in (tests/common/loginConfig.js). A campaign with this name left by an earlier run
//                is deleted first (only this script uses this name).
//
// Steps and expected results
//   1. Log in and open Campaigns from the sidebar
//        -> The campaigns table is shown
//   2. Click "New campaign"
//        -> The "New campaign" dialog opens; "Create" is disabled while the name is empty
//   3. Type the campaign name and click "Create"
//        -> The server saves it (POST /api/campaigns returns 201)
//        -> The new campaign opens: its name as the heading, the tabs Analytics, Leads, Sequence, Schedule, Settings
//        -> It has no sequence yet ("No sequences yet"; the Sequence tab shows "No sequence in this campaign yet")
//   4. Go back to Campaigns
//        -> The new campaign is listed in the table, once
//   5. Reload the campaign from the table
//        -> It opens with the same name (it was saved, not just shown)
//
// Cleanup      : The campaign is deleted at the end (also when the test fails).
// Screenshots  : screenshots/Campaign/CreateCampaign-*.png
// =====================================================================================================================
const { test, expect } = require('@playwright/test');
const { loginStaging } = require('../common/createDeal');
const {
  openCampaigns, campaignTabs, openCampaign, openSection, createCampaign, deleteCampaignIfExists, campaignNames,
  backToCampaigns,
} = require('../common/campaign');

const CAMPAIGN = 'QA Auto - Create campaign';

test.afterEach(async ({ page }) => {
  await deleteCampaignIfExists(page, CAMPAIGN);
});

test('TC_CAMPAIGN_01: Create a campaign successfully', async ({ page }) => {
  const main = page.getByRole('main');

  // Step 1: Log in and open Campaigns
  await loginStaging(page);
  await openCampaigns(page);
  await deleteCampaignIfExists(page, CAMPAIGN);
  await backToCampaigns(page);

  // Steps 2-3: New campaign, Create disabled while empty, then create it (createCampaign checks both)
  await createCampaign(page, CAMPAIGN);
  for (const tab of ['Analytics', 'Leads', 'Sequence', 'Schedule', 'Settings']) {
    await expect(campaignTabs(page).getByRole('tab', { name: tab, exact: true })).toBeVisible();
  }
  await expect(main.getByText('No sequences yet')).toBeVisible();
  await openSection(page, 'Sequence');
  await expect(main.getByText('No sequence in this campaign yet')).toBeVisible();
  await page.screenshot({ path: 'screenshots/Campaign/CreateCampaign-1-created.png' });

  // Step 4: Listed once in the campaigns table
  await backToCampaigns(page);
  const names = await campaignNames(page);
  expect(names.filter(name => name === CAMPAIGN), `"${CAMPAIGN}" should be listed once`).toHaveLength(1);
  await page.screenshot({ path: 'screenshots/Campaign/CreateCampaign-2-listed.png' });

  // Step 5: Opens again from the table with the same name
  expect(await openCampaign(page, CAMPAIGN), 'The campaign should open from the table').toBe(true);
});
