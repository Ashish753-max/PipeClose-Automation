// =====================================================================================================================
// TC_CAMPAIGN_03 - Delete a campaign
// =====================================================================================================================
// Purpose      : A user can delete a campaign. It asks to confirm first, and Cancel keeps the campaign.
// Test data    : Campaign name "QA Auto - Delete campaign" (with a sequence, to check that it is deleted too)
// Precondition : User can log in. A campaign with this name left by an earlier run is deleted first
//                (only this script uses this name).
//
// Steps and expected results
//   1. Log in, open Campaigns, create the campaign "QA Auto - Delete campaign" and give it a sequence
//        -> The campaign opens with its sequence
//   2. Campaign actions (...) > "Delete campaign"
//        -> A dialog asks "Delete QA Auto - Delete campaign and all its sequences?"
//   3. Click "Cancel"
//        -> The dialog closes, nothing is deleted, and the campaign is still open
//   4. Campaign actions (...) > "Delete campaign" > "Delete"
//        -> The server deletes it (DELETE /api/campaigns/<id> succeeds)
//   5. Go back to Campaigns
//        -> The campaign is no longer listed
//
// Cleanup      : If the test fails before step 4, the campaign is deleted at the end.
// Screenshots  : screenshots/Campaign/DeleteCampaign-*.png
// =====================================================================================================================
const { test, expect } = require('@playwright/test');
const { loginStaging } = require('../common/createDeal');
const {
  openCampaigns, createCampaign, createSequence, deleteCampaign, deleteCampaignIfExists, campaignNames,
  backToCampaigns,
} = require('../common/campaign');

const CAMPAIGN = 'QA Auto - Delete campaign';

test.afterEach(async ({ page }) => {
  await deleteCampaignIfExists(page, CAMPAIGN);
});

test('TC_CAMPAIGN_03: Delete a campaign', async ({ page }) => {
  const main = page.getByRole('main');

  // Step 1: A campaign with a sequence to delete
  await loginStaging(page);
  await openCampaigns(page);
  await deleteCampaignIfExists(page, CAMPAIGN);
  await backToCampaigns(page);
  await createCampaign(page, CAMPAIGN);
  await createSequence(page, 'Delete campaign sequence');

  // Step 2: Delete asks to confirm
  await main.getByRole('button', { name: 'Campaign actions' }).first().click();
  await page.getByRole('button', { name: 'Delete campaign' }).click();
  const dialog = page.getByRole('dialog').filter({ hasText: `Delete ${CAMPAIGN} and all its sequences?` });
  await expect(dialog, 'Delete should ask to confirm').toBeVisible();
  await page.screenshot({ path: 'screenshots/Campaign/DeleteCampaign-1-confirm.png' });

  // Step 3: Cancel keeps the campaign
  const deletes = [];
  const watch = request => { if (request.method() === 'DELETE' && request.url().includes('/api/campaigns/')) deletes.push(request); };
  page.on('request', watch);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await page.waitForTimeout(1000);
  page.off('request', watch);
  expect(deletes, 'Cancel should not delete anything').toHaveLength(0);
  await expect(main.getByRole('heading', { name: CAMPAIGN, exact: true, level: 2 })).toBeVisible();

  // Step 4: Delete it (deleteCampaign confirms and checks the server deleted it)
  await deleteCampaign(page);

  // Step 5: No longer listed
  await backToCampaigns(page);
  expect(await campaignNames(page), `"${CAMPAIGN}" should no longer be listed`).not.toContain(CAMPAIGN);
  await page.screenshot({ path: 'screenshots/Campaign/DeleteCampaign-2-gone.png' });
});
