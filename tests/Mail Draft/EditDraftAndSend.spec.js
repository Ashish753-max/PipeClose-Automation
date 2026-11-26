// Mail > ashish.rai@appnox.ai > Drafts: open the first draft, edit it and send it
//   1. Drafts: open the first (newest) draft whose recipients are team test addresses; the "Edit Draft" form shows
//      its recipient, subject and body
//   2. Edit: change the subject and the first line of the body (the signature stays)
//   3. Send: the edits are saved (PUT /api/email/drafts/<id>) and the draft is sent (POST /api/email/drafts/<id>/send)
//   4. Drafts no longer lists the draft
//   5. Sent folder: lists the edited email, to the same recipients, with the new subject and body
// Each run sends (and so uses up) the newest draft. The Mail Draft/SaveDraftMail*.spec.js scripts save new ones.
// The email is real: it goes to the draft's recipients and says it is an automated test.
// Screenshots: screenshots/MailDraft/EditDraftAndSend-*.png
const { test, expect } = require('@playwright/test');
const { loginStaging } = require('../common/createDeal');
const { openMail, useMailbox, openFolder, openSent, emailRows, scrollToEmailRow } = require('../common/mail');

const MAILBOX = 'ashish.rai@appnox.ai';

// Address part of a stored value, e.g. "Dev Bisht" <dev.bisht@appnox.ai>
const addressOf = text => text.match(/[^\s<>"]+@[^\s<>"]+/)?.[0].toLowerCase() ?? text;
const addressesOf = list => (list || []).map(addressOf);
// The address as it was saved, for what the page shows (it keeps capitals, e.g. Kunal.appnox@gmail.com)
const shownAddress = text => text.match(/[^\s<>"]+@[^\s<>"]+/)?.[0] ?? text;
// Only drafts to the team's own test addresses are sent. Other tests leave drafts to made-up addresses such as
// deal.details+123@gmail.com, which Gmail would deliver to a stranger's deal.details@gmail.com.
const isTeamAddress = address => /@appnox\.ai$/.test(address) || /appnox\d*@gmail\.com$/.test(address);
const isTestDraft = email => email.to.length > 0 && [...email.to, ...(email.cc || []), ...(email.bcc || [])]
  .map(addressOf).every(isTeamAddress);

test(`Edit the first draft in ${MAILBOX} and send it`, async ({ page }) => {
  test.setTimeout(240000);
  const time = new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const editedText = `This draft was edited and sent by an automated PipeClose test (${time}). Please ignore.`;

  await loginStaging(page);
  await expect(page).toHaveURL(/\/deals/, { timeout: 30000 });
  await openMail(page);
  await useMailbox(page, MAILBOX);

  // The draft form and its parts
  const heading = page.getByRole('heading', { name: 'Edit Draft', level: 4 });
  const form = heading.locator('xpath=ancestor::*[.//button[normalize-space()="Save Draft"]][1]');
  const fieldRow = label => form.locator('label', { hasText: new RegExp(`^${label}$`, 'i') }).locator('xpath=..');
  const subjectField = form.getByPlaceholder("What's this about?");
  const editor = form.locator('.ProseMirror').first();

  let draft; // the first draft, as the Drafts list loaded it
  let draftsBefore;
  await test.step('Drafts: open the first draft', async () => {
    const drafts = await openFolder(page, MAILBOX, 'Drafts');
    draftsBefore = drafts.total;
    const index = drafts.emails.findIndex(isTestDraft);
    expect(index, 'Drafts should have a draft to a team address (run a Mail Draft/SaveDraftMail test to save one)')
      .toBeGreaterThanOrEqual(0);
    draft = drafts.emails[index];
    if (index > 0) console.log(`Skipped ${index} newer draft(s) to addresses outside the team`);
    console.log(`Draft ${index + 1} of ${drafts.total}: "${draft.subject}" to ${draft.to.join(', ')}`);

    // The list only draws the rows in view, so scroll down to the draft if it is further down
    const row = emailRows(page).nth(index);
    await scrollToEmailRow(page, row);
    await row.scrollIntoViewIfNeeded();
    await expect(row).toContainText(draft.subject);
    await expect(row.getByRole('heading', { level: 4 })).toContainText(shownAddress(draft.to[0]), { ignoreCase: true });
    await page.screenshot({ path: 'screenshots/MailDraft/EditDraftAndSend-1-drafts.png' });
    await row.click();

    // The form shows what the draft saved
    await expect(heading).toBeVisible({ timeout: 30000 });
    await expect(form.getByRole('combobox').filter({ hasText: '@' }).first()).toContainText(MAILBOX);
    for (const address of draft.to) {
      await expect(fieldRow('To').getByText(shownAddress(address), { exact: true }), `To should show ${address}`).toBeVisible();
    }
    await expect(subjectField).toHaveValue(draft.subject);
    await expect(editor).toContainText('Best Regards');
    await page.screenshot({ path: 'screenshots/MailDraft/EditDraftAndSend-2-draft-opened.png' });
  });

  const editedSubject = `${draft.subject} - edited ${time}`;

  await test.step('Edit: new subject and first line of the body', async () => {
    await subjectField.fill(editedSubject);

    // Replace the first line of the body. The editor can still be loading the draft, which can wipe what was typed,
    // so wait until it stops changing and type again if needed.
    await expect.poll(async () => {
      const before = await editor.innerHTML();
      await page.waitForTimeout(1000);
      return before === await editor.innerHTML();
    }, { message: 'The draft editor should finish loading', timeout: 20000 }).toBe(true);
    const firstLine = editor.locator('p').first();
    const oldFirstLine = (await firstLine.innerText()).trim();
    await expect(async () => {
      // A triple-click selects the whole paragraph (Shift+End would only reach the end of the first wrapped line)
      await firstLine.click({ clickCount: 3 });
      await page.keyboard.insertText(editedText);
      await expect(firstLine).toHaveText(editedText, { timeout: 2000 });
    }).toPass({ timeout: 30000 });
    if (oldFirstLine) {
      await expect(editor.getByText(oldFirstLine, { exact: true }), 'The old first line should be replaced').toHaveCount(0);
    }
    await expect(editor, 'The signature should stay').toContainText('Best Regards');
    await expect(subjectField).toHaveValue(editedSubject);
    await page.screenshot({ path: 'screenshots/MailDraft/EditDraftAndSend-3-edited.png' });
  });

  await test.step('Send the edited draft', async () => {
    // A draft is not sent with /api/emails/send like a new email, but with POST /api/email/drafts/<id>/send.
    // Keep every request Send makes to /api/email/..., to check the edits went with it.
    const requests = [];
    const keep = request => {
      if (request.url().includes('/api/email/') && !['GET', 'OPTIONS'].includes(request.method())) requests.push(request);
    };
    page.on('request', keep);
    const payload = request => { try { return request.postDataJSON() || {}; } catch { return {}; } };
    let sent;
    try {
      [sent] = await Promise.all([
        page.waitForResponse(r => /\/api\/email\/drafts\/[^/]+\/send$/.test(new URL(r.url()).pathname)
          && r.request().method() === 'POST', { timeout: 60000 }),
        form.getByRole('button', { name: 'Send', exact: true }).click(),
      ]);
    } finally {
      page.off('request', keep);
      console.log('Requests made by Send:\n  ' + requests.map(r => `${r.method()} ${new URL(r.url()).pathname} `
        + JSON.stringify(payload(r)).slice(0, 120)).join('\n  '));
    }
    expect(sent.ok(), `Draft send API returned ${sent.status()}`).toBeTruthy();
    // The edited subject, recipients and body go to the server (in the send request, or in the save just before it)
    const request = requests.map(payload).find(p => p.subject === editedSubject);
    expect(request, 'The edited subject should be sent to the server').toBeTruthy();
    expect(new URL(sent.url()).pathname, 'The draft that was opened should be sent').toContain(draft.id);
    expect(request.from).toBe(MAILBOX);
    expect(addressesOf(request.to), 'The email should go to the draft\'s recipients').toEqual(addressesOf(draft.to));
    expect(request.subject).toBe(editedSubject);
    expect(request.body).toContain(editedText);
    await expect.soft(page.getByText('Your email has been sent successfully'), 'Success message should be shown')
      .toBeVisible({ timeout: 15000 });
    await expect(heading, 'The draft form should close after sending').toBeHidden();
    console.log(`Sent the edited draft "${editedSubject}" to ${draft.to.join(', ')}`);
  });

  await test.step('Drafts no longer lists the draft', async () => {
    let drafts;
    await expect(async () => {
      drafts = await openFolder(page, MAILBOX, 'Drafts');
      expect(drafts.emails.map(e => e.id), 'The sent draft should leave Drafts').not.toContain(draft.id);
    }).toPass({ timeout: 60000 });
    // Not checked: the total. It is not a reliable count (other tests and saves change it at any time).
    console.log(`Drafts: ${draftsBefore} before, ${drafts.total} now; the sent draft is no longer listed`);
    await expect(emailRows(page).filter({ hasText: editedSubject })).toHaveCount(0);
    await page.screenshot({ path: 'screenshots/MailDraft/EditDraftAndSend-4-drafts-after.png' });
  });

  await test.step('Sent folder: lists the edited email', async () => {
    let email;
    await expect(async () => {
      const emails = await openSent(page, MAILBOX);
      email = emails.find(e => e.subject === editedSubject);
      expect(email, 'The edited email should be listed in Sent').toBeTruthy();
    }).toPass({ timeout: 90000 });
    expect(addressOf(email.from)).toBe(MAILBOX);
    expect(addressesOf(email.to)).toEqual(addressesOf(draft.to));

    const row = emailRows(page).filter({ hasText: editedSubject });
    await expect(row, 'Sent should list the email once').toHaveCount(1);
    await expect(row.getByRole('heading', { level: 4 })).toContainText(shownAddress(draft.to[0]), { ignoreCase: true });
    await page.screenshot({ path: 'screenshots/MailDraft/EditDraftAndSend-5-sent.png' });

    await row.click();
    await expect(page.getByRole('heading', { name: editedSubject, level: 1 })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(`<${MAILBOX}>`).last()).toBeVisible();
    await expect(page.getByText(`to ${shownAddress(draft.to[0])}`).last()).toBeVisible();
    // The email body is drawn in an iframe
    await expect(page.locator('iframe').last().contentFrame().getByText(editedText), 'The opened email should show the edited text')
      .toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'screenshots/MailDraft/EditDraftAndSend-6-sent-opened.png' });
  });
});
