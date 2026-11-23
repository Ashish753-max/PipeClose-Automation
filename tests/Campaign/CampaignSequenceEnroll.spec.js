const { test, expect } = require('@playwright/test');
const { loginStaging } = require('../common/createDeal');
const {
  BASE_URL, openCampaigns, campaignTabs, openSection, deleteCampaignIfExists, createSequence, chooseSendingAccount,
  activateSequence, openEnrolled,
} = require('../common/campaign');

// Created by this test on every run (only this test uses this name, so no other campaign is ever deleted).
// A campaign has one sequence.
const CAMPAIGN = 'QA Auto - Sequence enroll';
const SEQUENCE = 'Test case 1';
const SENDER = 'ashish.rai@appnox.ai';
const LEAD_NAMES = ['shivang', 'vijay', 'aman', 'govind', 'shashank', 'kunal', 'abhijeet'];

// Address part of a stored value, e.g. "Ashish Rai" <ashish.rai@appnox.ai>
const addressOf = text => text.match(/[^\s<>"]+@[^\s<>"]+/)?.[0] ?? text;

// Opens the sender's Sent folder and returns the emails it loaded
async function openSent(page) {
  if (/folder=sent/i.test(page.url())) {
    await page.getByRole('button', { name: 'Inbox', exact: true }).click();
    await page.waitForTimeout(1000);
  }
  const [list] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/emails/list?') && r.url().includes('folder=sent')
      && decodeURIComponent(r.url()).includes(SENDER)),
    page.getByRole('button', { name: 'Sent', exact: true }).click(),
  ]);
  return (await list.json()).data.emails;
}

test('Campaign: create a campaign and its sequence, draft email, enroll leads and verify in Sent', async ({ page }) => {
  test.setTimeout(2400000); // campaign sends are throttled to about one email every 90 seconds
  const stamp = new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const subject = `QA Auto campaign email ${stamp}`;
  const body = 'Hi {{firstName|there}},\n\nThis is an automated QA campaign email from PipeClose. Please ignore.\n\nThanks';
  const main = page.getByRole('main');

  await loginStaging(page);
  await openCampaigns(page);
  await deleteCampaignIfExists(page, CAMPAIGN);

  // 1. New campaign: it opens on its own page, with no sequence yet
  await main.getByRole('button', { name: 'New campaign' }).click();
  const createCampaign = page.getByRole('dialog').getByRole('button', { name: 'Create' });
  await expect(createCampaign, 'Create should be disabled with an empty name').toBeDisabled();
  await page.getByRole('textbox', { name: 'Campaign name' }).fill('   ');
  await expect.soft(createCampaign, 'Whitespace-only campaign name should not be allowed').toBeDisabled();
  await page.getByRole('textbox', { name: 'Campaign name' }).fill(CAMPAIGN);
  const [campaignRes] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/api/campaigns') && r.request().method() === 'POST'),
    createCampaign.click(),
  ]);
  expect(campaignRes.status()).toBe(201);
  await expect(campaignTabs(page)).toBeVisible({ timeout: 30000 });
  await expect(main.getByRole('heading', { name: CAMPAIGN, level: 2 })).toBeVisible();
  await openSection(page, 'Sequence');
  await expect(main.getByText('No sequence in this campaign yet')).toBeVisible();
  await page.screenshot({ path: 'screenshots/Campaign/Campaign-1-created.png' });

  // 2. The campaign's sequence (a campaign has one)
  await createSequence(page, SEQUENCE);
  await expect(main.getByText('1 sequence · none sending')).toBeVisible();

  // 3. Sending account (Settings tab) + email step
  await chooseSendingAccount(page, SENDER);
  await openSection(page, 'Sequence');
  await main.getByRole('button', { name: 'Email', exact: true }).click();
  await page.getByRole('textbox', { name: 'Subject' }).fill(subject);
  await page.getByRole('textbox', { name: 'Body' }).fill(body);
  const [stepRes] = await Promise.all([
    page.waitForResponse(r => /\/steps\/[^/]+$/.test(r.url()) && r.request().method() === 'PATCH'),
    page.getByRole('button', { name: 'Save step' }).click(),
  ]);
  expect(stepRes.ok(), `Save step returned ${stepRes.status()}`).toBeTruthy();
  const stepItems = page.getByRole('list', { name: 'Sequence steps' }).getByRole('listitem');
  await expect(stepItems).toHaveCount(1);
  await expect(stepItems.first()).toContainText(`Step 1: ${subject}`);
  await page.screenshot({ path: 'screenshots/Campaign/Campaign-2-email-step.png' });

  // 4. Start the sequence
  await activateSequence(page);

  // 5. Leads tab -> Enroll leads, pick every lead found for each name
  await openEnrolled(page);
  await main.getByRole('button', { name: 'Enroll leads' }).first().click();
  const dialog = page.getByRole('dialog');
  const search = dialog.getByRole('textbox', { name: 'Search leads by name' });
  const notFound = [];
  const picked = [];
  for (const name of LEAD_NAMES) {
    const [res] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/leads/get?search=')
        && new URL(r.url()).searchParams.get('search') === name),
      search.fill(name),
    ]);
    const leads = (await res.json()).data?.leads ?? [];
    if (!leads.length) {
      await expect(dialog.getByText('No results found')).toBeVisible();
      notFound.push(name);
      continue;
    }
    for (const lead of leads) {
      if (picked.includes(lead.title)) continue;
      // Picking a lead clears the search, so search again for the next one
      if ((await search.inputValue()) !== name) {
        await Promise.all([
          page.waitForResponse(r => r.url().includes('/api/leads/get?search=')),
          search.fill(name),
        ]);
      }
      await dialog.locator('div.cursor-pointer').filter({ hasText: lead.title }).first().click();
      await expect(dialog.getByRole('list', { name: 'Leads to enroll' }).getByText(lead.title, { exact: true })).toBeVisible();
      picked.push(lead.title);
    }
  }
  console.log('Picked leads:', picked);
  expect.soft(notFound, 'Every name should match a lead').toEqual([]);
  const enrollBtn = dialog.getByRole('button', { name: `Enroll ${picked.length}` });
  await expect(enrollBtn).toBeEnabled();
  await page.screenshot({ path: 'screenshots/Campaign/Campaign-3-enroll-picked.png' });

  const [enrollRes] = await Promise.all([
    page.waitForResponse(r => /enroll/i.test(r.url()) && r.request().method() === 'POST', { timeout: 60000 }),
    enrollBtn.click(),
  ]);
  const enrollBody = await enrollRes.json().catch(() => ({}));
  console.log('Enroll response:', enrollRes.status(), JSON.stringify(enrollBody).slice(0, 2000));
  expect(enrollRes.ok(), `Enroll returned ${enrollRes.status()}`).toBeTruthy();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/Campaign/Campaign-4-enroll-result.png' });
  if (await dialog.count()) console.log('After enroll:\n' + await dialog.ariaSnapshot());
  await page.keyboard.press('Escape');

  // 6. Wait until the step is sent to the enrolled leads (the campaign page reloads on its own URL)
  await expect(async () => {
    await page.reload();
    await expect(campaignTabs(page)).toBeVisible({ timeout: 30000 });
    await openEnrolled(page);
    const summary = await main.getByText(/\d+ people in this sequence/).innerText();
    const states = await main.getByRole('img', { name: /^Scheduled/ }).getAttribute('aria-label');
    console.log(new Date().toLocaleTimeString(), summary, '|', states);
    expect(parseInt(summary, 10)).toBeGreaterThan(0);
    expect(states).toMatch(/Scheduled 0, Active 0/);
  }, 'All enrollments should finish sending').toPass({ timeout: 1800000, intervals: [30000] });
  await page.screenshot({ path: 'screenshots/Campaign/Campaign-5-enrolled.png', fullPage: true });
  const rows = await main.getByRole('listitem').allInnerTexts();
  console.log('Enrolled rows:\n' + rows.join('\n---\n'));

  // 7. Sent folder of ashish.rai@appnox.ai shows the campaign emails
  await page.goto(`${BASE_URL}/mail`);
  const mailbox = page.getByRole('button', { name: /\S+@\S+\.\S+/ }).first();
  await mailbox.waitFor({ timeout: 30000 });
  if (!(await mailbox.innerText()).includes(SENDER)) {
    await mailbox.click();
    await page.getByRole('button', { name: SENDER }).first().click();
  }
  let sent = [];
  await expect(async () => {
    const emails = await openSent(page);
    sent = emails.filter(e => e.subject === subject);
    expect(sent.length).toBeGreaterThan(0);
  }, 'Campaign emails should be in Sent').toPass({ timeout: 120000, intervals: [10000] });
  console.log(`Sent folder has ${sent.length} "${subject}" emails to:`, sent.flatMap(e => e.to.map(addressOf)));
  expect.soft(sent.length, 'One Sent email per completed enrollment').toBe(rows.filter(r => /Completed/.test(r)).length);
  for (const e of sent) {
    expect.soft(addressOf(e.from)).toBe(SENDER);
    expect.soft(JSON.stringify(e), 'Merge fields should be replaced').not.toContain('{{');
  }

  const row = page.getByRole('heading', { level: 4 }).locator('xpath=ancestor::div[contains(@class,"cursor-pointer")][1]')
    .filter({ hasText: subject }).first();
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.getByRole('heading', { name: subject, level: 1 })).toBeVisible();
  await expect(page.getByText(`<${SENDER}>`).first()).toBeVisible();
  await expect.soft(page.getByText('{{firstName'), 'Opened email should not show raw merge fields').toHaveCount(0);
  await page.screenshot({ path: 'screenshots/Campaign/Campaign-6-sent-opened.png' });
});
