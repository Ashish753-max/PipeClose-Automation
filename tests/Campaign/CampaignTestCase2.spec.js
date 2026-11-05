// Campaigns > QA Test 3 > sequence "Test case 2": schedule an email to leads and check it in Mail > Sent
//   1. Open the sequence. If an earlier run used it, delete it and create it again
//      (leads that already got its email cannot be enrolled in it again)
//   2. Send from ashish.rai@appnox.ai
//   3. Add an email step with a subject and body, and save it
//   4. Activate the sequence (leads can only be enrolled while it is active)
//   5. Enroll leads: search each name in LEAD_NAMES and pick every lead found
//   6. The email is scheduled for every enrolled lead
//   7. Wait until the email has gone to every lead (about one email every 90 seconds, only in working hours)
//   8. Mail > Sent: there is one email per lead
//   9. Open each email: sender, recipient, subject, and the body with the first name filled in and its
//      paragraphs and line breaks kept
// NOTE: this sends real emails (about 10) to the leads, and takes up to 45 minutes.
// Screenshots: screenshots/Campaign/TestCase2-*.png
const { test, expect } = require('@playwright/test');
const { loginStaging } = require('../common/createDeal');
const {
  isSequenceUpdate, openCampaigns, openCampaign, openSequence, createSequence, deleteSequence, openEnrolled,
} = require('../common/campaign');
const { emailRows, openMail, useMailbox, openSent, scrollToEmailRow } = require('../common/mail');

const CAMPAIGN = 'QA Test 3';
const SEQUENCE = 'Test case 2';
const SENDER = 'ashish.rai@appnox.ai';
const LEAD_NAMES = ['kunal', 'aman', 'ashish', 'shashank', 'vijay', 'shivang', 'abhijeet'];
// {{firstName|there}} is replaced with the lead's first name ("there" when they have none)
const BODY = 'Hi {{firstName|there}},\n\n'
  + 'This is an automated QA email from the PipeClose campaign "QA Test 3", sequence "Test case 2". '
  + "We're checking that campaign emails are delivered and look right. Please ignore it.\n\n"
  + 'Thanks,\nAshish Rai';

test('Campaign QA Test 3 - Test case 2: schedule an email to leads and check it in Sent', async ({ page }) => {
  test.setTimeout(45 * 60 * 1000);
  const subject = `QA Test 3 - Test case 2 email ${currentTime()}`; // e.g. "... email 4 Nov, 13:31"

  // Step 1: Open the sequence, and create it again if an earlier run used it
  await loginStaging(page);
  await openCampaigns(page);
  expect(await openCampaign(page, CAMPAIGN), `Campaign "${CAMPAIGN}" should exist`).toBe(true);
  await openSequence(page, SEQUENCE);
  await startWithEmptySequence(page);
  await takeScreenshot(page, '1-sequence');

  // Step 2: Send from ashish.rai@appnox.ai
  await chooseSender(page);

  // Step 3: Add an email step with a subject and body, and save it
  await addEmailStep(page, subject);

  // Step 4: Activate the sequence
  await activateSequence(page);

  // Step 5: Enroll leads
  const pickedLeads = await pickLeads(page);
  await takeScreenshot(page, '3-leads-picked');
  const enrolledLeads = await enrollLeads(page, pickedLeads);
  await takeScreenshot(page, '4-enroll-result');
  await closeEnrollDialog(page);

  // Step 6: The email is scheduled for every enrolled lead
  await checkScheduled(page, enrolledLeads);
  await takeScreenshot(page, '5-scheduled', true);

  // Step 7: Wait until the email has gone to every lead
  const sentToLeads = await waitUntilSent(page, enrolledLeads);
  await takeScreenshot(page, '6-completed', true);

  // Step 8: Mail > Sent: one email per lead
  await openMail(page);
  await useMailbox(page, SENDER);
  const sentEmails = await findSentEmails(page, subject, sentToLeads.length);
  await takeScreenshot(page, '7-sent-folder');

  // Step 9: Open each email and check it
  for (const lead of sentToLeads) {
    await checkSentEmail(page, lead, subject, sentEmails);
    await takeScreenshot(page, `8-opened-${lead.email}`);
  }
  console.log(`Checked ${sentToLeads.length} "${subject}" emails in Sent:`, sentToLeads.map(lead => lead.email));
});

// ---------------------------------------------------------------- Parts of the sequence page

function sequenceDetail(page) {
  return page.getByRole('region', { name: 'Sequence detail' });
}

function sendsFromDropdown(page) {
  return page.getByRole('combobox', { name: 'Sends from' });
}

function sequenceSteps(page) {
  return page.getByRole('list', { name: 'Sequence steps' }).getByRole('listitem');
}

// The status bar of the Enrolled view; its label reads e.g. "Scheduled 0, Active 0, Completed 10, ..."
function statusSummary(page) {
  return sequenceDetail(page).getByRole('img', { name: /^Scheduled \d+, Active \d+/ });
}

// A lead's row in the Enrolled view
function enrolledRow(page, lead) {
  return sequenceDetail(page).getByRole('listitem').filter({ has: page.getByText(lead.title, { exact: true }) });
}

// ---------------------------------------------------------------- Steps 1-4: the sequence and its email

// Step 1: if an earlier run added a step or chose a sender, delete the sequence and create it again
async function startWithEmptySequence(page) {
  const steps = sequenceSteps(page);
  // Wait for the steps to load: the sequence shows its steps, or "Add the first step"
  await expect(steps.first().or(sequenceDetail(page).getByText('Add the first step'))).toBeVisible();
  const hasSteps = (await steps.count()) > 0;
  const hasSender = await sendsFromDropdown(page).evaluate(select => select.selectedIndex > 0);
  if (hasSteps || hasSender) {
    console.log(`"${SEQUENCE}" was used by an earlier run: deleting it and creating it again`);
    await deleteSequence(page);
    await createSequence(page, SEQUENCE);
  }
  await expect(steps).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Activate sequence' }), 'Cannot activate without a step').toBeDisabled();
  await expect(sequenceDetail(page).getByRole('tab', { name: 'Steps' })).toHaveAttribute('aria-selected', 'true');
}

// Step 2: choose the sender (saved at once)
async function chooseSender(page) {
  await Promise.all([
    page.waitForResponse(isSequenceUpdate),
    sendsFromDropdown(page).selectOption(SENDER),
  ]);
  const chosen = await sendsFromDropdown(page).inputValue(); // e.g. "2-ashish.rai@appnox.ai"
  expect(chosen.endsWith(SENDER), `The sender should be ${SENDER}`).toBe(true);
}

// Step 3: "Email" adds a step called "New step"; fill in its subject and body, and save it
async function addEmailStep(page, subject) {
  const [addResponse] = await Promise.all([
    page.waitForResponse(res => /\/api\/sequences\/[^/]+\/steps$/.test(res.url()) && res.request().method() === 'POST'),
    sequenceDetail(page).getByRole('button', { name: 'Email', exact: true }).click(),
  ]);
  expect(addResponse.ok(), 'Adding the email step should succeed').toBe(true);

  const subjectField = page.getByRole('textbox', { name: 'Subject' });
  await expect(subjectField).toHaveValue('New step');
  await subjectField.fill(subject);
  await page.getByRole('textbox', { name: 'Body' }).fill(BODY);
  await takeScreenshot(page, '2-email-draft');

  const [saveResponse] = await Promise.all([
    page.waitForResponse(res => /\/steps\/[^/]+$/.test(res.url()) && res.request().method() === 'PATCH'),
    page.getByRole('button', { name: 'Save step' }).click(),
  ]);
  expect(saveResponse.ok(), 'Saving the email step should succeed').toBe(true);
  expect(saveResponse.request().postDataJSON()).toMatchObject({ subject, body: BODY });
  await expect(sequenceSteps(page)).toHaveCount(1);
  await expect(sequenceSteps(page).first()).toContainText(`Step 1: ${subject}`);
}

// Step 4: activate the sequence; it starts "Sending" and the sender can no longer be changed
async function activateSequence(page) {
  await Promise.all([
    page.waitForResponse(res => isSequenceUpdate(res) && res.request().postData().includes('isActive')),
    page.getByRole('button', { name: 'Activate sequence' }).click(),
  ]);
  await expect(page.getByRole('button', { name: 'Pause sequence' })).toBeVisible();
  await expect(page.getByRole('tab', { name: `${SEQUENCE} Sending`, exact: true })).toBeVisible();
  await expect(sendsFromDropdown(page), 'The sender is locked while sending').toBeDisabled();
}

// ---------------------------------------------------------------- Step 5: enroll leads

// Opens "Enroll leads", searches each name and picks every lead found.
// Returns the picked leads: [{ id, title, firstName, email }]
async function pickLeads(page) {
  await openEnrolled(page);
  await sequenceDetail(page).getByRole('button', { name: 'Enroll leads' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(`into ${SEQUENCE}`, { exact: true })).toBeVisible();
  const searchBox = dialog.getByRole('textbox', { name: 'Search leads by name' });

  const picked = [];
  const notFound = [];
  for (const name of LEAD_NAMES) {
    const leads = await searchLeads(page, name);
    if (leads.length === 0) {
      await expect(dialog.getByText('No results found')).toBeVisible();
      notFound.push(name);
      continue;
    }
    for (const lead of leads) {
      if (picked.some(pickedLead => pickedLead.id === lead.id)) continue; // found by an earlier name
      // Picking a lead clears the search box, so search again for the next lead with the same name
      if ((await searchBox.inputValue()) !== name) await searchLeads(page, name);
      await dialog.locator('div.cursor-pointer').filter({ has: page.getByText(lead.title, { exact: true }) }).first().click();
      const chosenList = dialog.getByRole('list', { name: 'Leads to enroll' });
      await expect(chosenList.getByText(lead.title, { exact: true })).toBeVisible();
      picked.push({
        id: lead.id,
        title: lead.title,
        firstName: lead.person?.firstName,
        email: lead.person?.emails?.[0]?.email,
      });
    }
  }
  console.log('Picked leads:', picked.map(lead => `${lead.title} <${lead.email}>`));
  expect.soft(notFound, 'Every name should match a lead').toEqual([]);
  return picked;
}

// Types a name in the Enroll dialog's search box and returns the leads found
async function searchLeads(page, name) {
  const searchBox = page.getByRole('dialog').getByRole('textbox', { name: 'Search leads by name' });
  const [response] = await Promise.all([
    page.waitForResponse(res => res.url().includes('/api/leads/get?')
      && new URL(res.url()).searchParams.get('search') === name),
    searchBox.fill(name),
  ]);
  const body = await response.json();
  return body.data?.leads ?? [];
}

// Clicks "Enroll N", which schedules the email for the leads. Leads that cannot get it (suppressed or not
// verified) are skipped. Returns the enrolled leads.
async function enrollLeads(page, pickedLeads) {
  const enrollButton = page.getByRole('dialog').getByRole('button', { name: `Enroll ${pickedLeads.length}`, exact: true });
  await expect(enrollButton).toBeEnabled();
  const [response] = await Promise.all([
    page.waitForResponse(res => /enroll/i.test(res.url()) && res.request().method() === 'POST', { timeout: 60000 }),
    enrollButton.click(),
  ]);
  expect(response.status(), 'Enrolling should succeed').toBe(201);
  const body = await response.json();
  const enrolledIds = body.data.enrolledLeadIds;
  const skipped = body.data.skipped || []; // [{ leadId, reason }]

  const enrolled = pickedLeads.filter(lead => enrolledIds.includes(lead.id));
  console.log('Enrolled:', enrolled.map(lead => lead.title));
  console.log('Skipped:', skipped.map(item => `${leadTitle(pickedLeads, item.leadId)} (${item.reason})`));
  expect(enrolled.length + skipped.length, 'Every picked lead is enrolled or skipped with a reason').toBe(pickedLeads.length);
  expect(enrolled.length, 'At least one lead should be enrolled').toBeGreaterThan(0);
  return enrolled;
}

async function closeEnrollDialog(page) {
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible()) await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
}

// ---------------------------------------------------------------- Steps 6-7: scheduled, then sent

// Step 6: after a reload, every enrolled lead is listed with the email scheduled (or already on its way)
async function checkScheduled(page, enrolledLeads) {
  const data = await reloadAndOpenEnrolled(page);
  for (const lead of enrolledLeads) {
    expect(statusOf(data, lead), `${lead.title} should be enrolled`).toMatch(/^(SCHEDULED|ACTIVE|COMPLETED)$/);
    await expect(enrolledRow(page, lead)).toBeVisible();
  }
  await expect(sequenceDetail(page).getByText(`${enrolledLeads.length} people in this sequence`)).toBeVisible();
  console.log('Right after enrolling:', await statusSummary(page).getAttribute('aria-label'));
}

// Step 7: reloads the Enrolled view every 30 seconds until no email is waiting (Scheduled or Active).
// Returns the leads that got the email (Completed).
async function waitUntilSent(page, enrolledLeads) {
  const deadline = Date.now() + 30 * 60 * 1000;
  let data = await reloadAndOpenEnrolled(page);
  while (data.statusCounts.SCHEDULED + data.statusCounts.ACTIVE > 0) {
    console.log(new Date().toLocaleTimeString(), await statusSummary(page).getAttribute('aria-label'));
    if (Date.now() > deadline) {
      throw new Error('Not every lead got the email within 30 minutes (campaigns only send in working hours)');
    }
    await page.waitForTimeout(30000);
    data = await reloadAndOpenEnrolled(page);
  }

  const sentToLeads = enrolledLeads.filter(lead => statusOf(data, lead) === 'COMPLETED');
  expect.soft(sentToLeads.map(lead => lead.title), 'Every enrolled lead should get the email')
    .toEqual(enrolledLeads.map(lead => lead.title));
  for (const lead of sentToLeads) {
    await expect(enrolledRow(page, lead)).toContainText('Completed');
  }
  await expect(statusSummary(page)).toHaveAttribute('aria-label', new RegExp(`Completed ${data.statusCounts.COMPLETED},`));
  return sentToLeads;
}

// Reloads the page, opens the sequence again and shows its Enrolled view. Returns { enrollments, statusCounts }.
async function reloadAndOpenEnrolled(page) {
  await page.reload();
  await openCampaign(page, CAMPAIGN);
  await openSequence(page, SEQUENCE);
  return openEnrolled(page);
}

// A lead's status in the sequence: SCHEDULED, ACTIVE, COMPLETED, ...
function statusOf(enrolledData, lead) {
  const enrollment = enrolledData.enrollments.find(item => item.leadId === lead.id);
  return enrollment?.status;
}

// ---------------------------------------------------------------- Steps 8-9: the emails in Mail > Sent

// Step 8: opens Sent (again every 15 seconds, for up to 3 minutes, until all the emails are there) and returns the
// emails with this subject
async function findSentEmails(page, subject, expectedCount) {
  const deadline = Date.now() + 3 * 60 * 1000;
  let emails = await openSent(page, SENDER);
  let withSubject = emails.filter(email => email.subject === subject);
  while (withSubject.length < expectedCount) {
    if (Date.now() > deadline) {
      throw new Error(`Sent lists ${withSubject.length} of the ${expectedCount} emails after 3 minutes`);
    }
    await page.waitForTimeout(15000);
    emails = await openSent(page, SENDER);
    withSubject = emails.filter(email => email.subject === subject);
  }
  expect(withSubject.length, 'One Sent email per lead').toBe(expectedCount);
  return withSubject;
}

// Step 9: checks the email to one lead, as saved and as shown when opened from Sent
async function checkSentEmail(page, lead, subject, sentEmails) {
  const expectedBody = bodyFor(lead);

  // As saved: from the sender, to this lead only, the body with their first name, and an unsubscribe link at the end
  const email = sentEmails.find(item => item.to.map(emailAddress).includes(lead.email));
  expect(email, `Sent should have the email to ${lead.email}`).toBeTruthy();
  expect(emailAddress(email.from)).toBe(SENDER);
  expect(email.to.map(emailAddress)).toEqual([lead.email]);
  expect(email.body.slice(0, expectedBody.length), `Body sent to ${lead.email}`).toBe(expectedBody);
  expect(email.body, 'An unsubscribe link should be added at the end')
    .toMatch(/unsubscribe here:\nhttps:\/\/staging\.pipeclose\.com\/u\/\S+$/);

  // In the Sent list: one row for this lead, with the greeting in its preview
  await openSent(page, SENDER);
  const row = emailRows(page)
    .filter({ has: page.getByRole('heading', { level: 4, name: lead.email, exact: true }) })
    .filter({ hasText: subject });
  await scrollToEmailRow(page, row);
  await expect(row, `One row for the email to ${lead.email}`).toHaveCount(1);
  await expect(row).toContainText(`Hi ${lead.firstName},`);

  // Opened: the subject, the sender and the recipient
  await row.click();
  await expect(page.getByRole('heading', { name: subject, level: 1 })).toBeVisible();
  await expect(page.getByText(`<${SENDER}>`).first()).toBeVisible();
  await expect(page.getByText(`to ${lead.email}`).first()).toBeVisible();

  // The body is shown in a frame as 4 paragraphs: greeting, text, signature (with its line break), unsubscribe.
  // Nothing should be left unformatted: no HTML tags, no &-codes, no {{merge fields}}.
  const content = page.getByRole('main').locator('iframe').contentFrame();
  const paragraphs = content.locator('p');
  await expect(paragraphs).toHaveCount(4);
  const shownText = await content.locator('body').evaluate(body => body.innerText);
  expect(shownText.slice(0, expectedBody.length), `Body shown for ${lead.email}`).toBe(expectedBody);
  expect(shownText, 'No raw HTML, &-codes or merge fields').not.toMatch(/<\/?(p|br|a)\b|&(amp|apos|quot|lt|gt);|\{\{/);
  await expect(paragraphs.last()).toContainText("If you'd rather not hear from me again, you can unsubscribe here:");
  await expect(paragraphs.last().getByRole('link', { name: /^https:\/\/staging\.pipeclose\.com\/u\// })).toBeVisible();
}

// ---------------------------------------------------------------- Small helpers

// The body a lead should get: the merge field replaced with their first name
function bodyFor(lead) {
  return BODY.replace('{{firstName|there}}', lead.firstName || 'there');
}

// The email address in a value like '"Ashish Rai" <ashish.rai@appnox.ai>'
function emailAddress(text) {
  const match = text.match(/[^\s<>"]+@[^\s<>"]+/);
  return match ? match[0] : text;
}

function leadTitle(leads, leadId) {
  const lead = leads.find(item => item.id === leadId);
  return lead ? lead.title : leadId;
}

// e.g. "4 Nov, 13:31"
function currentTime() {
  return new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

async function takeScreenshot(page, step, fullPage = false) {
  await page.screenshot({ path: `screenshots/Campaign/TestCase2-${step}.png`, fullPage });
}
