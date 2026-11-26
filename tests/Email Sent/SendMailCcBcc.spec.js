// Mail > ashish.rai@appnox.ai > Compose Mail: send an email with To, Cc and Bcc
//   1. Compose: To govind.singh@appnox.ai, Cc abhijeet.appnox@gmail.com, Bcc shivang.appnox@gmail.com
//   2. Send: each address goes in its own field
//   3. Sent folder: lists the email with the same To, Cc and Bcc, and it opens
// The email is real, so it says it is an automated test. Every run sends one to all three addresses.
// Screenshots: screenshots/EmailSent/SendMailCcBcc-*.png
const { test, expect } = require('@playwright/test');
const { loginStaging } = require('../common/createDeal');
const { openMail, useMailbox, openSent, emailRows } = require('../common/mail');

const MAILBOX = 'ashish.rai@appnox.ai';
const TO = 'govind.singh@appnox.ai';
const CC = 'abhijeet.appnox@gmail.com';
const BCC = 'shivang.appnox@gmail.com';

// Address part of a stored value, e.g. "Govind Singh" <govind.singh@appnox.ai>
const addressOf = text => text.match(/[^\s<>"]+@[^\s<>"]+/)?.[0].toLowerCase() ?? text;
const addressesOf = list => (list || []).map(addressOf);

test('Send an email with Cc and Bcc', async ({ page }) => {
  test.setTimeout(240000);
  const time = new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const subject = `Cc and Bcc test ${time}`;
  const body = `Hi team, this is an automated test of sending an email with Cc and Bcc from PipeClose (${time}). Please ignore.`;

  await loginStaging(page);
  await expect(page).toHaveURL(/\/deals/, { timeout: 30000 });
  await openMail(page);
  await useMailbox(page, MAILBOX);

  // The compose form and its parts
  await page.getByRole('button', { name: 'Compose Mail' }).first().click();
  const heading = page.getByRole('heading', { name: 'New Message', level: 4 });
  await expect(heading).toBeVisible();
  const form = heading.locator('xpath=ancestor::*[.//button[normalize-space()="Save Draft"]][1]');
  const fieldRow = label => form.locator('label', { hasText: new RegExp(`^${label}$`, 'i') }).locator('xpath=..');
  const input = label => fieldRow(label).locator('input');
  const chip = (label, address) => fieldRow(label).getByText(address, { exact: true });
  const send = form.getByRole('button', { name: 'Send', exact: true });

  // Types an address in a field and presses Enter (it becomes a chip), then closes the suggestion list
  async function addAddress(label, address) {
    await input(label).fill(address);
    await input(label).press('Enter');
    await page.keyboard.press('Escape');
    await expect(chip(label, address), `${address} should be added to ${label}`).toHaveCount(1);
  }

  await test.step('Compose: To, Cc, Bcc, subject and message', async () => {
    const from = form.getByRole('combobox').filter({ hasText: '@' }).first();
    if (!(await from.innerText()).includes(MAILBOX)) {
      await from.click();
      await page.getByRole('option', { name: MAILBOX }).first().click();
    }
    await expect(from).toContainText(MAILBOX);

    await addAddress('To', TO);
    // Cc and Bcc open with the arrow button next to To
    await fieldRow('To').getByRole('button').last().click();
    await expect(input('Cc')).toBeVisible();
    await expect(input('Bcc')).toBeVisible();
    await addAddress('Cc', CC);
    await addAddress('Bcc', BCC);
    // Each address is only in its own field
    await expect(chip('To', CC)).toHaveCount(0);
    await expect(chip('To', BCC)).toHaveCount(0);
    await expect(chip('Cc', BCC)).toHaveCount(0);

    await form.getByPlaceholder("What's this about?").fill(subject);

    // Type on the empty first line, above the signature. The editor can still be loading the signature, which can
    // wipe what was typed, so wait until it stops changing and type again if needed.
    const editor = form.locator('.ProseMirror').first();
    await expect(editor).toContainText('Best Regards');
    await expect.poll(async () => {
      const before = await editor.innerHTML();
      await page.waitForTimeout(1000);
      return before === await editor.innerHTML();
    }, { message: 'The editor should finish loading', timeout: 20000 }).toBe(true);
    const firstLine = editor.locator('p').first();
    await expect(firstLine, 'The message should start with an empty line above the signature').toHaveText('');
    await expect(async () => {
      await firstLine.click();
      await page.keyboard.press('Control+Home');
      await page.keyboard.press('Shift+End'); // replaces what a wiped attempt left on the line
      await page.keyboard.type(body);
      await expect(firstLine).toHaveText(body, { timeout: 2000 });
    }).toPass({ timeout: 30000 });
    await expect(send).toBeEnabled();
    await page.screenshot({ path: 'screenshots/EmailSent/SendMailCcBcc-1-compose.png' });
  });

  await test.step('Send: each address goes in its own field', async () => {
    const [sent] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith('/api/emails/send') && r.request().method() === 'POST', { timeout: 60000 }),
      send.click(),
    ]);
    expect(sent.ok(), `Send API returned ${sent.status()}`).toBeTruthy();
    const request = sent.request().postDataJSON();
    expect(request.from).toBe(MAILBOX);
    expect(addressesOf(request.to), 'To').toEqual([TO]);
    expect(addressesOf(request.cc), 'Cc').toEqual([CC]);
    expect(addressesOf(request.bcc), 'Bcc').toEqual([BCC]);
    expect(request.subject).toBe(subject);
    expect(request.body).toContain(body);
    await expect.soft(page.getByText('Your email has been sent successfully'), 'Success message should be shown')
      .toBeVisible({ timeout: 15000 });
    await expect(heading, 'Compose should close after sending').toBeHidden();
    console.log(`Sent "${subject}": to ${TO}, cc ${CC}, bcc ${BCC}`);
  });

  await test.step('Sent folder: lists the email with the same To, Cc and Bcc', async () => {
    let email;
    await expect(async () => {
      const emails = await openSent(page, MAILBOX);
      email = emails.find(e => e.subject === subject);
      expect(email, 'The email should be listed in Sent').toBeTruthy();
    }).toPass({ timeout: 90000 });
    console.log(`Saved in Sent: to ${email.to}, cc ${email.cc}, bcc ${email.bcc}`);
    expect(addressOf(email.from)).toBe(MAILBOX);
    expect(addressesOf(email.to), 'To in Sent').toEqual([TO]);
    expect(addressesOf(email.cc), 'Cc in Sent').toEqual([CC]);
    expect(addressesOf(email.bcc), 'Bcc in Sent').toEqual([BCC]);

    const row = emailRows(page).filter({ hasText: subject });
    await expect(row, 'Sent should list the email once').toHaveCount(1);
    await expect(row.getByRole('heading', { level: 4 }), 'Sent should show the To recipient').toContainText(TO);
    await page.screenshot({ path: 'screenshots/EmailSent/SendMailCcBcc-2-sent.png' });

    await row.click();
    await expect(page.getByRole('heading', { name: subject, level: 1 })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(`<${MAILBOX}>`).last()).toBeVisible();
    // Under the sender: "to govind.singh@appnox.ai, cc: abhijeet.appnox@gmail.com, bcc: shivang.appnox@gmail.com"
    const recipients = page.getByText(new RegExp(`^to ${TO.replace(/\./g, '\\.')}`)).last();
    await expect(recipients).toBeVisible();
    await expect(recipients, 'The opened email should show the Cc address').toContainText(`cc: ${CC}`);
    await expect(recipients, 'The opened email should show the Bcc address').toContainText(`bcc: ${BCC}`);
    // The email body is drawn in an iframe
    await expect(page.locator('iframe').last().contentFrame().getByText(body), 'The opened email should show the message')
      .toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'screenshots/EmailSent/SendMailCcBcc-3-sent-opened.png' });
  });
});
