// Mail > ashish.rai@appnox.ai: reply to the latest email Vijay sent
//   1. Inbox: find Vijay's email and open it
//   2. Reply: the reply form is filled in with Vijay's address and "Re: <subject>"
//   3. Send the reply: it goes to Vijay, in the same conversation
//   4. Thread: the reply is added to the conversation below Vijay's email
//   5. Sent folder: lists the reply, sent to Vijay
// The reply is a real email to Vijay, so it says it is an automated test. Every run sends one.
// Screenshots: screenshots/EmailReply/ReplyToEmail-*.png
const { test, expect } = require('@playwright/test');
const { loginStaging } = require('../common/createDeal');
const { openMail, useMailbox, isEmailList, openSent, emailRows } = require('../common/mail');

const MAILBOX = 'ashish.rai@appnox.ai';
const VIJAY = 'vijaysingh.appnox@gmail.com';

// Address part of a stored value, e.g. "Vijay Singh" <vijaysingh.appnox@gmail.com>
const addressOf = text => text.match(/[^\s<>"]+@[^\s<>"]+/)?.[0].toLowerCase() ?? text;
// "2 messages in this conversation" above the thread
const messageCount = page => page.getByText(/^\d+ messages? in this conversation$/);
const replyForm = page => page.getByRole('heading', { name: 'New Message', level: 4 });

test(`Reply to Vijay's email from ${MAILBOX}`, async ({ page }) => {
  test.setTimeout(240000);
  const time = new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const replyText = `Hi Vijay, this is an automated reply test from PipeClose (${time}). Please ignore.`;

  await loginStaging(page);
  await expect(page).toHaveURL(/\/deals/, { timeout: 30000 });
  await openMail(page);
  await useMailbox(page, MAILBOX);

  let email; // Vijay's email, as the Inbox list loaded it
  await test.step("Inbox: find Vijay's email and open it", async () => {
    // Search the Inbox for Vijay's address, so his email is on top even when newer emails came in
    const [response] = await Promise.all([
      page.waitForResponse(r => isEmailList(r, 'inbox', MAILBOX) && new URL(r.url()).searchParams.get('search') === VIJAY,
        { timeout: 30000 }),
      page.getByPlaceholder('Search emails...').fill(VIJAY),
    ]);
    expect(response.ok(), `Inbox search returned ${response.status()}`).toBeTruthy();
    const { emails } = (await response.json()).data;
    const index = emails.findIndex(e => addressOf(e.from) === VIJAY);
    expect(index, `The Inbox should have an email from ${VIJAY}`).toBeGreaterThanOrEqual(0);
    email = emails[index];
    console.log(`Vijay's latest email: "${email.subject}" from ${email.from}`);

    const row = emailRows(page).nth(index);
    await expect(row).toContainText(email.subject);
    await page.screenshot({ path: 'screenshots/EmailReply/ReplyToEmail-1-inbox.png' });
    await row.click();
    await expect(page.getByRole('button', { name: 'Back to Inbox' })).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('heading', { name: email.subject, level: 1 })).toBeVisible();
    await expect(page.getByText(`<${VIJAY}>`).last(), "Vijay's message should be shown").toBeVisible();
    await page.screenshot({ path: 'screenshots/EmailReply/ReplyToEmail-2-opened.png' });
  });

  // A reply keeps the subject, adding "Re: " unless it already starts with it
  const replySubject = /^re:/i.test(email.subject) ? email.subject : `Re: ${email.subject}`;
  let messagesBefore = 1; // a single email shows no "N messages" line

  await test.step('Reply: the form is filled in for Vijay', async () => {
    if (await messageCount(page).isVisible()) {
      messagesBefore = Number((await messageCount(page).innerText()).match(/\d+/)[0]);
    }
    console.log(`Conversation before the reply: ${messagesBefore} message(s)`);

    await page.getByRole('button', { name: 'Reply', exact: true }).click();
    await expect(replyForm(page)).toBeVisible();
    const from = page.getByRole('combobox').filter({ hasText: '@' }).first();
    await expect(from, `The reply should be sent from ${MAILBOX}`).toContainText(MAILBOX);
    const toRow = page.locator('label', { hasText: /^To$/ }).locator('xpath=..');
    await expect(toRow.getByText(VIJAY, { exact: true }), 'The reply should go to Vijay').toBeVisible();
    await expect(page.getByPlaceholder("What's this about?")).toHaveValue(replySubject);

    // Type on the empty first line, above the signature. The editor loads the signature and the quoted email just
    // after the form opens, which can wipe what was typed, so wait until it stops changing and type again if needed.
    const editor = page.locator('.ProseMirror').first();
    await expect(editor).toContainText('Best Regards');
    await expect.poll(async () => {
      const before = await editor.innerHTML();
      await page.waitForTimeout(1000);
      return before === await editor.innerHTML();
    }, { message: 'The reply editor should finish loading', timeout: 20000 }).toBe(true);
    const firstLine = editor.locator('p').first();
    await expect(firstLine, 'The reply should start with an empty line above the signature').toHaveText('');
    await expect(async () => {
      await firstLine.click();
      await page.keyboard.press('Control+Home');
      await page.keyboard.press('Shift+End'); // replaces what a wiped attempt left on the line
      await page.keyboard.type(replyText);
      await expect(firstLine).toHaveText(replyText, { timeout: 2000 });
    }).toPass({ timeout: 30000 });
    await expect(editor, 'The signature should be kept below the reply').toContainText('Best Regards');
    await page.screenshot({ path: 'screenshots/EmailReply/ReplyToEmail-3-reply-form.png' });
  });

  await test.step('Send the reply to Vijay', async () => {
    const [sent] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith('/api/emails/send') && r.request().method() === 'POST', { timeout: 60000 }),
      page.getByRole('button', { name: 'Send', exact: true }).click(),
    ]);
    expect(sent.ok(), `Send API returned ${sent.status()}`).toBeTruthy();
    const request = sent.request().postDataJSON();
    console.log(`Send request fields: ${Object.keys(request).join(', ')}`);
    expect(request.from).toBe(MAILBOX);
    expect(request.to.map(addressOf)).toEqual([VIJAY]);
    expect(request.subject).toBe(replySubject);
    expect(request.body).toContain(replyText);
    await expect.soft(page.getByText('Your email has been sent successfully'), 'Success message should be shown')
      .toBeVisible({ timeout: 15000 });
    await expect(replyForm(page), 'The reply form should close after sending').toBeHidden();
    console.log(`Replied to ${VIJAY}: "${replySubject}"`);
  });

  await test.step('Thread: the reply is added to the conversation', async () => {
    // After sending, the app goes back to the Inbox list: open Vijay's email again (until the thread has the reply)
    await expect(async () => {
      if (await page.getByRole('button', { name: 'Back to Inbox' }).isVisible()) {
        await page.getByRole('button', { name: 'Back to Inbox' }).click();
      }
      await emailRows(page).filter({ hasText: email.subject }).first().click({ timeout: 10000 });
      await expect(page.getByRole('heading', { name: email.subject, level: 1 })).toBeVisible({ timeout: 10000 });
      await expect(messageCount(page)).toHaveText(`${messagesBefore + 1} messages in this conversation`, { timeout: 5000 });
    }, 'The conversation should count the reply').toPass({ timeout: 90000 });

    // The reply is the newest message of the thread, below Vijay's email, sent from ashish.rai@appnox.ai
    const replyMessage = page.getByRole('button').filter({ hasText: replyText });
    await expect(replyMessage, 'The reply should be shown in the thread').toHaveCount(1);
    await expect(replyMessage).toContainText(MAILBOX);
    await expect(replyMessage).toContainText('Sent');
    const vijayBox = await page.getByText(`<${VIJAY}>`).last().boundingBox();
    const replyBox = await replyMessage.boundingBox();
    expect(replyBox.y, "The reply should be below Vijay's email").toBeGreaterThan(vijayBox.y);
    console.log(`Thread now has ${messagesBefore + 1} messages; the reply is the last one`);
    await replyMessage.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'screenshots/EmailReply/ReplyToEmail-4-thread.png' });
  });

  await test.step('Sent folder: lists the reply, sent to Vijay', async () => {
    // Back to the list, and clear the search (it stays on when another folder is opened)
    await page.getByRole('button', { name: 'Back to Inbox' }).click();
    await page.getByPlaceholder('Search emails...').fill('');
    let reply;
    await expect(async () => {
      const emails = await openSent(page, MAILBOX);
      reply = emails.find(e => e.subject === replySubject && (e.body || e.snippet || '').includes(replyText));
      expect(reply, 'The reply should be listed in Sent').toBeTruthy();
    }).toPass({ timeout: 90000 });
    expect(addressOf(reply.from)).toBe(MAILBOX);
    expect(reply.to.map(addressOf)).toEqual([VIJAY]);
    expect(reply.threadId, "The reply should be in the same conversation as Vijay's email").toBe(email.threadId);

    // Earlier test replies have the same subject: the row of this one shows its time in the preview
    const row = emailRows(page).filter({ hasText: replySubject }).filter({ hasText: `(${time})` });
    await expect(row, 'Sent should list this reply once').toHaveCount(1);
    await expect(row.getByRole('heading', { level: 4 }), 'Sent should show Vijay as the recipient').toHaveText(VIJAY);
    await page.screenshot({ path: 'screenshots/EmailReply/ReplyToEmail-5-sent.png' });

    await row.click();
    await expect(page.getByRole('heading', { name: replySubject, level: 1 })).toBeVisible({ timeout: 30000 });
    // The whole conversation is shown, with the reply open at the bottom: its body is drawn in an iframe
    await expect(messageCount(page)).toHaveText(`${messagesBefore + 1} messages in this conversation`);
    await expect(page.getByText(`<${MAILBOX}>`).last()).toBeVisible();
    await expect(page.getByText(`to ${VIJAY}`).last()).toBeVisible();
    await expect(page.locator('iframe').last().contentFrame().getByText(replyText), 'The opened reply should show its text')
      .toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'screenshots/EmailReply/ReplyToEmail-6-sent-opened.png' });
  });
});
