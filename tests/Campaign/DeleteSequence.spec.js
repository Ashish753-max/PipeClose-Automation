// =====================================================================================================================
// TC_CAMPAIGN_05 - Delete a sequence successfully
// =====================================================================================================================
// Purpose      : A user can delete a campaign's sequence. The campaign stays, and a new sequence can be created.
// Test data    : Campaign "QA Auto - Delete sequence", sequence "QA Sequence to delete" with one email step
// Precondition : User can log in. A campaign with this name left by an earlier run is deleted first
//                (only this script uses this name).
//
// Steps and expected results
//   1. Log in, open Campaigns, create the campaign "QA Auto - Delete sequence" and its sequence, and add an
//      email step to the sequence
//        -> The sequence is shown with "Step 1"; the header shows "1 sequence · none sending"
//   2. Sequence tab > "Delete this sequence" (the bin icon)
//        -> A dialog asks to confirm
//   3. Confirm with "Delete"
//        -> The server deletes it (DELETE /api/sequences/<id> succeeds)
//        -> The Sequence tab shows "No sequence in this campaign yet" and "Create sequence" again
//        -> The header shows "No sequences yet"
//        -> The campaign itself is not deleted (its name is still the heading)
//   4. Reload the page and open the Sequence tab
//        -> The sequence is still gone (it was deleted on the server)
//
// Cleanup      : The campaign is deleted at the end (also when the test fails).
// Screenshots  : screenshots/Campaign/DeleteSequence-*.png
// =====================================================================================================================
const { test, expect } = require('@playwright/test');
const { loginStaging } = require('../common/createDeal');
const {
  openCampaigns, campaignTabs, openSection, createCampaign, createSequence, deleteCampaignIfExists, backToCampaigns,
  addEmailStep, deleteSequence,
} = require('../common/campaign');

const CAMPAIGN = 'QA Auto - Delete sequence';
const SEQUENCE = 'QA Sequence to delete';

test.afterEach(async ({ page }) => {
  await deleteCampaignIfExists(page, CAMPAIGN);
});

test('TC_CAMPAIGN_05: Delete a sequence successfully', async ({ page }) => {
  const main = page.getByRole('main');

  // Step 1: A campaign with a sequence that has a step
  await loginStaging(page);
  await openCampaigns(page);
  await deleteCampaignIfExists(page, CAMPAIGN);
  await backToCampaigns(page);
  await createCampaign(page, CAMPAIGN);
  await createSequence(page, SEQUENCE);
  await addEmailStep(page, 'QA step - sequence to delete', 'Hi {{firstName|there}},\n\nThis step is deleted with its sequence.');
  await expect(main.getByText('1 sequence · none sending')).toBeVisible();
  await page.screenshot({ path: 'screenshots/Campaign/DeleteSequence-1-before.png' });

  // Steps 2-3: Delete it (deleteSequence confirms the dialog, checks the server and "No sequence in this campaign yet")
  await deleteSequence(page);
  await expect(main.getByRole('heading', { name: SEQUENCE, exact: true, level: 1 })).toHaveCount(0);
  await expect(main.getByRole('button', { name: 'Create sequence' }), 'A new sequence can be created').toBeVisible();
  await expect(main.getByText('No sequences yet')).toBeVisible();
  await expect(main.getByRole('heading', { name: CAMPAIGN, exact: true, level: 2 }), 'The campaign should stay')
    .toBeVisible();
  await page.screenshot({ path: 'screenshots/Campaign/DeleteSequence-2-deleted.png' });

  // Step 4: Still gone after a reload
  await page.reload();
  await expect(campaignTabs(page)).toBeVisible({ timeout: 30000 });
  await openSection(page, 'Sequence');
  await expect(main.getByText('No sequence in this campaign yet'), 'The sequence should be deleted on the server')
    .toBeVisible({ timeout: 30000 });
});


