// Mail > ashish.rai@appnox.ai > Compose Mail: what the form accepts before an email can be sent
//   1. Empty form: Send and Send options are disabled
//   2. Invalid addresses are not added to To (each is checked with a subject and body filled in, so only the
//      recipient keeps Send disabled), and the user is told why
//   3. A valid address is added as a recipient and Send becomes enabled; the same address is not added twice
//   4. Cc refuses an invalid address and Bcc takes a valid one
//   5. Back to emails leaves the form
// The test NEVER sends: it fails if a send or draft request goes out. The suggestion list under To is closed with
// Escape after each address. Screenshots: screenshots/EmailCompose/ComposeValidation-*.png
const { test, expect } = require('@playwright/test');
const { loginStaging } = require('../common/createDeal');
const { openMail, useMailbox } = require('../common/mail');

const MAILBOX = 'ashish.rai@appnox.ai';
const VALID = 'kunal.sharma@appnox.ai';

test(`Compose validation in ${MAILBOX}`, async ({ page }) => {
  test.setTimeout(180000);
  const stamp = Date.now().toString().slice(-6);
  // Unique, so no contact suggestion matches them (Enter would pick a suggestion)
  const INVALID = [`not-an-email-${stamp}`, `ashish${stamp}@`, `two words${stamp}@appnox.ai`, `@appnox${stamp}.ai`];

  // Any send or save request means the test changed the mailbox: it must never happen
  const writes = [];
  page.on('request', req => {
    const url = req.url();
    if (url.includes('/api/') && !['GET', 'OPTIONS'].includes(req.method())
      && !url.includes('/recipients/blocked') && !url.includes('/auth/login')) writes.push(`${req.method()} ${url}`);
  });

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
  const send = form.getByRole('button', { name: 'Send', exact: true });
  const sendOptions = form.getByRole('button', { name: 'Send options' });
  const subject = form.getByPlaceholder("What's this about?");
  const editor = form.locator('[contenteditable="true"]').first();
  // An address added as a recipient shows as its own chip in the row
  const chip = (label, address) => fieldRow(label).getByText(address, { exact: true });
  const errorMessage = form.getByText(/invalid|not a valid|valid email/i);

  // Types an address in a field and presses Enter, then closes the suggestion list
  async function addAddress(label, address) {
    await input(label).fill(address);
    await input(label).press('Enter');
    await page.waitForTimeout(500); // the chip, or the refusal, appears after a short check
    await page.keyboard.press('Escape');
  }

  await test.step('Empty form: Send and Send options are disabled', async () => {
    await expect(form.getByRole('combobox').first(), `The email should be sent from ${MAILBOX}`).toContainText(MAILBOX);
    await expect(send).toBeDisabled();
    await expect(sendOptions).toBeDisabled();
    await expect(form.getByRole('button', { name: 'Save Draft' })).toBeEnabled();
  });

  await test.step('Invalid addresses are not added to To', async () => {
    await subject.fill(`Compose validation ${stamp}`);
    await editor.click();
    await page.keyboard.press('Control+Home');
    await page.keyboard.type('Compose validation check - this email is never sent.');
    for (const address of INVALID) {
      await addAddress('To', address);
      await expect(chip('To', address), `"${address}" should not be added as a recipient`).toHaveCount(0);
      await expect(send, `Send should stay disabled with only "${address}"`).toBeDisabled();
      await expect(sendOptions).toBeDisabled();
      // The user should be told the address is wrong (today the text is just left in the box)
      await expect.soft(errorMessage, `An error should explain that "${address}" is not a valid email address`).toBeVisible({ timeout: 2000 });
      if (address === INVALID[0]) await page.screenshot({ path: 'screenshots/EmailCompose/ComposeValidation-1-invalid.png' });
      await input('To').fill('');
    }
  });

  await test.step('A valid address is added and Send is enabled; it is not added twice', async () => {
    await addAddress('To', VALID);
    await expect(chip('To', VALID), `${VALID} should be added as a recipient`).toHaveCount(1);
    await expect(input('To'), 'The box should be empty once the address is added').toHaveValue('');
    await expect(send, 'Send should be enabled with a valid recipient, a subject and a body').toBeEnabled();
    await expect(sendOptions).toBeEnabled();

    await addAddress('To', VALID);
    await expect.soft(chip('To', VALID), `${VALID} should not be added to To twice`).toHaveCount(1);
  });

  await test.step('Cc refuses an invalid address and Bcc takes a valid one', async () => {
    // Cc and Bcc open with the arrow button next to To
    await fieldRow('To').getByRole('button').last().click();
    await expect(input('Cc')).toBeVisible();
    await expect(input('Bcc')).toBeVisible();
    const badCc = `bad-cc-${stamp}`;
    await addAddress('Cc', badCc);
    await expect(chip('Cc', badCc), `"${badCc}" should not be added to Cc`).toHaveCount(0);
    await expect.soft(errorMessage, `An error should explain that "${badCc}" is not a valid email address`).toBeVisible({ timeout: 2000 });
    await input('Cc').fill('');
    await addAddress('Bcc', VALID);
    await expect(chip('Bcc', VALID), `${VALID} should be added to Bcc`).toHaveCount(1);
    await page.screenshot({ path: 'screenshots/EmailCompose/ComposeValidation-2-valid.png' });
  });

  await test.step('Back to emails leaves the form without sending', async () => {
    await form.getByRole('button', { name: 'Back to emails' }).click();
    await expect(heading).toBeHidden();
    await expect(page.getByRole('button', { name: 'Compose Mail' }).first()).toBeVisible();
  });

  expect(writes, 'Nothing should be sent or saved').toEqual([]);
});
