// =====================================================================================================================
// TC_CAMPAIGN_04 - Add a sequence to a campaign successfully
// =====================================================================================================================
// Purpose      : A user can create the sequence of a campaign. A new sequence is paused and cannot be activated
//                until it has a step. A campaign has only one sequence.
// Test data    : Campaign "QA Auto - Add sequence", sequence "QA Sequence 1"
// Precondition : User can log in. A campaign with this name left by an earlier run is deleted first
//                (only this script uses this name).
//
// Steps and expected results
//   1. Log in, open Campaigns and create the campaign "QA Auto - Add sequence"
//        -> The campaign opens, with "No sequences yet"
//   2. Open the Sequence tab
//        -> "No sequence in this campaign yet" and a "Create sequence" button
//   3. Click "Create sequence"
//        -> A dialog opens; "Create" is disabled while the name is empty
//   4. Type "QA Sequence 1" and click "Create"
//        -> The server saves it (POST /api/campaigns/<id>/sequences returns 201)
//        -> The sequence is shown with its name, "Paused — not sending", and no steps
//        -> "Activate sequence" is disabled, with "Add at least one step first"
//        -> The step buttons Email, Wait and Manual task are shown
//        -> The campaign header shows "1 sequence · none sending"
//        -> "Create sequence" is gone (a campaign has one sequence)
//   5. Reload the page and open the Sequence tab
//        -> The sequence is still there (it was saved)
//
// Cleanup      : The campaign (and its sequence) is deleted at the end (also when the test fails).
// Screenshots  : screenshots/Campaign/AddSequence-*.png
// =====================================================================================================================
const { test, expect } = require('@playwright/test');
const { loginStaging } = require('../common/createDeal');
const {
  openCampaigns, campaignTabs, openSection, createCampaign, createSequence, deleteCampaignIfExists, backToCampaigns,
  sequenceSteps,
} = require('../common/campaign');

const CAMPAIGN = 'QA Auto - Add sequence';
const SEQUENCE = 'QA Sequence 1';

test.afterEach(async ({ page }) => {
  await deleteCampaignIfExists(page, CAMPAIGN);
});

test('TC_CAMPAIGN_04: Add a sequence successfully', async ({ page }) => {
  const main = page.getByRole('main');

  // Step 1: A new campaign without a sequence
  await loginStaging(page);
  await openCampaigns(page);
  await deleteCampaignIfExists(page, CAMPAIGN);
  await backToCampaigns(page);
  await createCampaign(page, CAMPAIGN);
  await expect(main.getByText('No sequences yet')).toBeVisible();

  // Step 2: The Sequence tab offers to create one
  await openSection(page, 'Sequence');
  await expect(main.getByText('No sequence in this campaign yet')).toBeVisible();
  await expect(main.getByRole('button', { name: 'Create sequence' })).toBeVisible();
  await page.screenshot({ path: 'screenshots/Campaign/AddSequence-1-empty.png' });

  // Steps 3-4: Create it. createSequence checks: Create disabled while empty, 201 from the server, the name,
  // "Paused — not sending", Activate disabled, and "Create sequence" gone.
  await createSequence(page, SEQUENCE);
  await expect(main.getByText('Add at least one step first')).toBeVisible();
  await expect(sequenceSteps(page), 'A new sequence has no steps').toHaveCount(0);
  for (const step of ['Email', 'Wait', 'Manual task']) {
    await expect(main.getByRole('button', { name: step, exact: true }), `"${step}" step button`).toBeVisible();
  }
  await expect(main.getByText('1 sequence · none sending')).toBeVisible();
  await page.screenshot({ path: 'screenshots/Campaign/AddSequence-2-created.png' });

  // Step 5: Still there after a reload
  await page.reload();
  await expect(campaignTabs(page)).toBeVisible({ timeout: 30000 });
  await openSection(page, 'Sequence');
  await expect(main.getByRole('heading', { name: SEQUENCE, exact: true, level: 1 }), 'The sequence should be saved')
    .toBeVisible({ timeout: 30000 });
  await expect(main.getByText('Paused — not sending')).toBeVisible();
});
