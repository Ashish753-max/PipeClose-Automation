// Mail > ashish.rai@appnox.ai: forward the latest email Vijay sent to dev.bisht@appnox.ai
//   1. Inbox: find Vijay's email and open it
//   2. Forward: the form has "Fwd: <subject>" and no recipient; add dev.bisht@appnox.ai
//   3. Send: the forward goes to Dev with Vijay's email in it
//   4. Sent folder: lists the forward, sent to Dev, and it opens
// The forward is a real email to Dev, so it says it is an automated test. Every run sends one.
// Screenshots: screenshots/EmailForward/ForwardEmail-*.png
const { test, expect } = require('@playwright/test');
const { loginStaging } = require('../common/createDeal');
const { openMail, useMailbox, isEmailList, openSent, emailRows } = require('../common/mail');

const MAILBOX = 'ashish.rai@appnox.ai';
const VIJAY = 'vijaysingh.appnox@gmail.com';
const FORWARD_TO = 'dev.bisht@appnox.ai';

// Address part of a stored value, e.g. "Vijay Singh" <vijaysingh.appnox@gmail.com>
const addressOf = text => text.match(/[^\s<>"]+@[^\s<>"]+/)?.[0].toLowerCase() ?? text;
const composeForm = page => page.getByRole('heading', { name: 'New Message', level: 4 });
const toRow = page => page.locator('label', { hasText: /^To$/ }).locator('xpath=..');

test(`Forward Vijay's email to ${FORWARD_TO}`, async ({ page }) => {
  test.setTimeout(240000);
  const time = new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const note = `Hi Dev, forwarding Vijay's email. This is an automated forward test from PipeClose (${time}). Please ignore.`;

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
    await page.screenshot({ path: 'screenshots/EmailForward/ForwardEmail-1-inbox.png' });
    await row.click();
    await expect(page.getByRole('button', { name: 'Back to Inbox' })).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('heading', { name: email.subject, level: 1 })).toBeVisible();
    await expect(page.getByText(`<${VIJAY}>`).last(), "Vijay's message should be shown").toBeVisible();
    await page.screenshot({ path: 'screenshots/EmailForward/ForwardEmail-2-opened.png' });
  });

  const forwardSubject = `Fwd: ${email.subject}`;

  await test.step('Forward: add dev.bisht@appnox.ai and a note', async () => {
    await page.getByRole('button', { name: 'Forward', exact: true }).click();
    await expect(composeForm(page)).toBeVisible();
    const from = page.getByRole('combobox').filter({ hasText: '@' }).first();
    await expect(from, `The forward should be sent from ${MAILBOX}`).toContainText(MAILBOX);
    await expect(page.getByPlaceholder("What's this about?")).toHaveValue(forwardSubject);
    await expect(toRow(page).getByText(/@/), 'A forward starts with no recipient').toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Send', exact: true }), 'Send needs a recipient').toBeDisabled();

    // Recipient becomes a chip when Enter is pressed
    await page.getByPlaceholder('Add recipients...').fill(FORWARD_TO);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape'); // closes the suggestion list
    await expect(toRow(page).getByText(FORWARD_TO, { exact: true })).toBeVisible();

    // Type on the empty first line, above the signature. The editor can still be loading the signature and the
    // forwarded email, which can wipe what was typed, so wait until it stops changing and type again if needed.
    const editor = page.locator('.ProseMirror').first();
    await expect(editor).toContainText('Best Regards');
    await expect.poll(async () => {
      const before = await editor.innerHTML();
      await page.waitForTimeout(1000);
      return before === await editor.innerHTML();
    }, { message: 'The forward editor should finish loading', timeout: 20000 }).toBe(true);
    const firstLine = editor.locator('p').first();
    await expect(firstLine, 'The forward should start with an empty line above the signature').toHaveText('');
    await expect(async () => {
      await firstLine.click();
      await page.keyboard.press('Control+Home');
      await page.keyboard.press('Shift+End'); // replaces what a wiped attempt left on the line
      await page.keyboard.type(note);
      await expect(firstLine).toHaveText(note, { timeout: 2000 });
    }).toPass({ timeout: 30000 });
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled();
    await page.screenshot({ path: 'screenshots/EmailForward/ForwardEmail-3-forward-form.png' });
  });

  await test.step(`Send the forward to ${FORWARD_TO}`, async () => {
    const [sent] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith('/api/emails/send') && r.request().method() === 'POST', { timeout: 60000 }),
      page.getByRole('button', { name: 'Send', exact: true }).click(),
    ]);
    expect(sent.ok(), `Send API returned ${sent.status()}`).toBeTruthy();
    const request = sent.request().postDataJSON();
    expect(request.from).toBe(MAILBOX);
    expect(request.to.map(addressOf)).toEqual([FORWARD_TO]);
    expect(request.subject).toBe(forwardSubject);
    expect(request.body).toContain(note);
    // The forwarded email is added below the note
    const vijayText = (email.snippet || email.body).trim().split(/\s+/).slice(0, 3).join(' ');
    const content = `${request.body} ${request.htmlBody}`.replace(/\s+/g, ' ');
    console.log(`Forward body: ${request.body.replace(/\s+/g, ' ').slice(0, 300)}`);
    expect(content, 'The forward should have the "Forwarded message" header').toContain('Forwarded message');
    expect(content, "The forward should contain Vijay's address").toContain(VIJAY);
    expect(content, `The forward should contain Vijay's message ("${vijayText}")`).toContain(vijayText);
    await expect.soft(page.getByText('Your email has been sent successfully'), 'Success message should be shown')
      .toBeVisible({ timeout: 15000 });
    await expect(composeForm(page), 'The forward form should close after sending').toBeHidden();
    console.log(`Forwarded "${email.subject}" to ${FORWARD_TO}`);
  });

  await test.step('Sent folder: lists the forward, sent to Dev', async () => {
    // Back to the list (if the opened email is still shown), and clear the search: it stays on in other folders
    const back = page.getByRole('button', { name: 'Back to Inbox' });
    if (await back.isVisible()) await back.click();
    await page.getByPlaceholder('Search emails...').fill('');
    let forward;
    await expect(async () => {
      const emails = await openSent(page, MAILBOX);
      forward = emails.find(e => e.subject === forwardSubject && (e.body || e.snippet || '').includes(note));
      expect(forward, 'The forward should be listed in Sent').toBeTruthy();
    }).toPass({ timeout: 90000 });
    expect(addressOf(forward.from)).toBe(MAILBOX);
    expect(forward.to.map(addressOf)).toEqual([FORWARD_TO]);

    // Earlier test forwards have the same subject: the row of this one shows its time in the preview
    const row = emailRows(page).filter({ hasText: forwardSubject }).filter({ hasText: `(${time})` });
    await expect(row, 'Sent should list this forward once').toHaveCount(1);
    await expect(row.getByRole('heading', { level: 4 }), 'Sent should show Dev as the recipient').toHaveText(FORWARD_TO);
    await page.screenshot({ path: 'screenshots/EmailForward/ForwardEmail-4-sent.png' });

    await row.click();
    await expect(page.getByRole('heading', { name: forwardSubject, level: 1 })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(`<${MAILBOX}>`).last()).toBeVisible();
    await expect(page.getByText(`to ${FORWARD_TO}`).last()).toBeVisible();
    // The email body is drawn in an iframe
    await expect(page.locator('iframe').last().contentFrame().getByText(note), 'The opened forward should show the note')
      .toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'screenshots/EmailForward/ForwardEmail-5-sent-opened.png' });
  });
});
