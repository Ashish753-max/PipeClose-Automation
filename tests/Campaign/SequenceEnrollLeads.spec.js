// =====================================================================================================================
// TC_CAMPAIGN_06 - Set the sending account, add an email step, activate the sequence and enroll at least 5 leads
// =====================================================================================================================
// Purpose      : The full set-up of a campaign that sends: sending account, email step, activation, and leads
//                enrolled from the sequence's Leads tab.
// Test data    : Campaign "QA Auto - Enroll leads", sequence "QA Enroll sequence"
//                Sending account: ashish.rai@appnox.ai
//                Email step: subject "QA Auto - Enroll leads email <date, time>" and the body below
//                Leads: searched by the names in LEAD_NAMES, one lead per name; at least 5 must be picked
// Precondition : User can log in; ashish.rai@appnox.ai is connected as a sending account; the leads exist.
//                The campaign left by the previous run is deleted first (only this script uses this name).
//
// Steps and expected results
//   1. Log in, open Campaigns, create the campaign "QA Auto - Enroll leads" and its sequence "QA Enroll sequence"
//        -> The sequence is shown, "Paused — not sending"
//   2. Settings tab: tick only ashish.rai@appnox.ai and click "Save settings"
//        -> The settings are saved with ashish.rai@appnox.ai as the sending account
//   3. Sequence tab > "Email": type the subject and body, then "Save step"
//        -> The step is saved with that subject and body, and is listed as "Step 1: <subject>"
//   4. Click "Activate sequence"
//        -> The sequence shows "Sending", "Pause sequence" is shown, and the header shows "1 sequence · 1 sending"
//   5. Leads tab > "Enroll leads": search each name and pick a lead
//        -> Each picked lead is added to "Leads to enroll"; at least 5 leads are picked
//   6. Click "Enroll N"
//        -> The server enrolls them (201); every picked lead is enrolled or skipped with a reason
//        -> At least 5 leads are enrolled
//   7. Reload and open the Leads tab
//        -> "<N> people in this sequence"; every enrolled lead is listed, with its email Scheduled, Active or
//           Completed
//
// NOTE         : Real emails are sent to the enrolled leads (about one every 90 seconds, in working hours).
//                The campaign is NOT deleted at the end, so the emails can go out; the next run deletes it.
// Screenshots  : screenshots/Campaign/EnrollLeads-*.png
// =====================================================================================================================
const { test, expect } = require('@playwright/test');
const { loginStaging } = require('../common/createDeal');
const {
  openCampaigns, campaignTabs, openSection, createCampaign, createSequence, deleteCampaignIfExists, backToCampaigns,
  chooseSendingAccount, addEmailStep, activateSequence, openEnrolled, pickLeadsToEnroll, enrollPickedLeads,
} = require('../common/campaign');

const CAMPAIGN = 'QA Auto - Enroll leads';
const SEQUENCE = 'QA Enroll sequence';
const SENDER = 'ashish.rai@appnox.ai';
const MIN_LEADS = 5;
const LEAD_NAMES = ['kunal', 'aman', 'shashank', 'vijay', 'shivang', 'abhijeet', 'govind'];
// The email format: {{firstName|there}} is replaced with the lead's first name ("there" when they have none)
const BODY = 'Hi {{firstName|there}},\n\n'
  + `This is an automated QA email from the PipeClose campaign "${CAMPAIGN}", sequence "${SEQUENCE}". `
  + "We're checking that campaign emails are delivered and look right. Please ignore it.\n\n"
  + 'Thanks,\nAshish Rai';

test('TC_CAMPAIGN_06: Sending account, email step, activate the sequence and enroll at least 5 leads', async ({ page }) => {
  test.setTimeout(10 * 60 * 1000);
  const main = page.getByRole('main');
  const subject = `QA Auto - Enroll leads email ${new Date().toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })}`;

  // Step 1: The campaign and its sequence (after deleting the one the previous run left)
  await loginStaging(page);
  await openCampaigns(page);
  await deleteCampaignIfExists(page, CAMPAIGN);
  await backToCampaigns(page);
  await createCampaign(page, CAMPAIGN);
  await createSequence(page, SEQUENCE);

  // Step 2: Send from ashish.rai@appnox.ai only (chooseSendingAccount ticks it, saves and checks it was sent)
  await chooseSendingAccount(page, SENDER);
  await page.screenshot({ path: 'screenshots/Campaign/EnrollLeads-1-settings.png' });

  // Step 3: The email step
  await addEmailStep(page, subject, BODY);
  await page.screenshot({ path: 'screenshots/Campaign/EnrollLeads-2-email-step.png' });

  // Step 4: Activate the sequence (activateSequence checks "Sending", "Pause sequence" and "1 sequence · 1 sending")
  await activateSequence(page);
  await page.screenshot({ path: 'screenshots/Campaign/EnrollLeads-3-activated.png' });

  // Step 5: Pick at least 5 leads
  const picked = await pickLeadsToEnroll(page, SEQUENCE, LEAD_NAMES);
  expect(picked.length, `At least ${MIN_LEADS} leads should be picked`).toBeGreaterThanOrEqual(MIN_LEADS);
  await page.screenshot({ path: 'screenshots/Campaign/EnrollLeads-4-picked.png' });

  // Step 6: Enroll them
  const { enrolled } = await enrollPickedLeads(page, picked);
  expect(enrolled.length, `At least ${MIN_LEADS} leads should be enrolled`).toBeGreaterThanOrEqual(MIN_LEADS);
  await page.screenshot({ path: 'screenshots/Campaign/EnrollLeads-5-enroll-result.png' });
  if (await page.getByRole('dialog').isVisible()) await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();

  // Step 7: After a reload, every enrolled lead is in the sequence with its email on the way
  await page.reload();
  await expect(campaignTabs(page)).toBeVisible({ timeout: 30000 });
  const data = await openEnrolled(page);
  await expect(main.getByText(`${enrolled.length} people in this sequence`)).toBeVisible();
  for (const lead of enrolled) {
    const status = data.enrollments.find(enrollment => enrollment.leadId === lead.id)?.status;
    expect(status, `${lead.title} should be enrolled`).toMatch(/^(SCHEDULED|ACTIVE|COMPLETED)$/);
    await expect(main.getByRole('listitem').filter({ has: page.getByText(lead.title, { exact: true }) }),
      `${lead.title} should be listed`).toBeVisible();
  }
  await page.screenshot({ path: 'screenshots/Campaign/EnrollLeads-6-enrolled.png', fullPage: true });
  console.log(`Enrolled ${enrolled.length} leads in "${SEQUENCE}":`, enrolled.map(lead => `${lead.title} <${lead.email}>`));

  // The Sequence tab still shows it sending
  await openSection(page, 'Sequence');
  await expect(main.getByText('Sending', { exact: true })).toBeVisible();
});
