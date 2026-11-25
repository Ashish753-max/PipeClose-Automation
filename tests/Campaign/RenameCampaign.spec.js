// =====================================================================================================================
// TC_CAMPAIGN_02 - Update (rename) a campaign
// =====================================================================================================================
// Purpose      : A user can change a campaign's name, and the new name is saved and shown everywhere.
// Test data    : Created as "QA Auto - Rename campaign", renamed to "QA Auto - Renamed campaign"
// Precondition : User can log in. Campaigns with either name left by an earlier run are deleted first
//                (only this script uses these names).
//
// Steps and expected results
//   1. Log in, open Campaigns and create the campaign "QA Auto - Rename campaign"
//        -> The campaign opens with that name
//   2. Campaign actions (...) > "Rename campaign"
//        -> A box shows the current name
//   3. Clear the box
//        -> An empty name cannot be saved (the save button is disabled, or nothing is saved)
//   4. Type "QA Auto - Renamed campaign" and save
//        -> The server saves it (PATCH/PUT /api/campaigns/<id> succeeds)
//        -> The heading shows the new name
//   5. Reload the page
//        -> The new name is still shown (it was saved)
//   6. Go back to Campaigns
//        -> The table lists the new name, and no longer lists the old one
//
// Cleanup      : The campaign is deleted at the end (also when the test fails).
// Screenshots  : screenshots/Campaign/RenameCampaign-*.png
// =====================================================================================================================
const { test, expect } = require('@playwright/test');
const { loginStaging } = require('../common/createDeal');
const {
  openCampaigns, campaignTabs, createCampaign, deleteCampaignIfExists, campaignNames, backToCampaigns, renameBox,
  renameCampaign,
} = require('../common/campaign');

const OLD_NAME = 'QA Auto - Rename campaign';
const NEW_NAME = 'QA Auto - Renamed campaign';

test.afterEach(async ({ page }) => {
  await deleteCampaignIfExists(page, NEW_NAME);
  await deleteCampaignIfExists(page, OLD_NAME);
});

test('TC_CAMPAIGN_02: Update the campaign name', async ({ page }) => {
  const main = page.getByRole('main');

  // Step 1: Create the campaign to rename
  await loginStaging(page);
  await openCampaigns(page);
  await deleteCampaignIfExists(page, NEW_NAME);
  await deleteCampaignIfExists(page, OLD_NAME);
  await backToCampaigns(page);
  await createCampaign(page, OLD_NAME);

  // Steps 2-3: Rename shows the current name, and an empty name cannot be saved
  await main.getByRole('button', { name: 'Campaign actions' }).first().click();
  await page.getByRole('button', { name: 'Rename campaign' }).click();
  await expect(renameBox(page), 'The box should show the current name').toHaveValue(OLD_NAME);
  const saves = [];
  const watch = request => {
    if (/\/api\/campaigns\/[^/]+$/.test(request.url()) && ['PATCH', 'PUT'].includes(request.method())) saves.push(request);
  };
  page.on('request', watch);
  await renameBox(page).fill('');
  const save = page.getByRole('dialog').getByRole('button', { name: /^(Save|Rename)/ });
  if (await save.count() && await save.first().isEnabled()) await save.first().click();
  else await renameBox(page).press('Enter');
  await page.waitForTimeout(1500);
  page.off('request', watch);
  expect(saves, 'An empty campaign name should not be saved').toHaveLength(0);
  await page.screenshot({ path: 'screenshots/Campaign/RenameCampaign-1-empty-name.png' });
  await page.keyboard.press('Escape');
  await expect(main.getByRole('heading', { name: OLD_NAME, exact: true, level: 2 })).toBeVisible();

  // Step 4: Rename it
  const response = await renameCampaign(page, NEW_NAME);
  expect(JSON.stringify(response.request().postDataJSON()), 'The new name should be sent').toContain(NEW_NAME);
  await page.screenshot({ path: 'screenshots/Campaign/RenameCampaign-2-renamed.png' });

  // Step 5: Still renamed after a reload
  await page.reload();
  await expect(campaignTabs(page)).toBeVisible({ timeout: 30000 });
  await expect(main.getByRole('heading', { name: NEW_NAME, exact: true, level: 2 }), 'The new name should be saved')
    .toBeVisible();

  // Step 6: The table lists the new name only
  await backToCampaigns(page);
  const names = await campaignNames(page);
  expect(names, 'The table should list the new name').toContain(NEW_NAME);
  expect(names, 'The table should no longer list the old name').not.toContain(OLD_NAME);
  await page.screenshot({ path: 'screenshots/Campaign/RenameCampaign-3-listed.png' });
});
