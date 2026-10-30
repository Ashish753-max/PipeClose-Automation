const { test, expect } = require('@playwright/test');
const { loginStaging } = require('../common/createDeal');

const BASE_URL = 'https://staging.pipeclose.com';
const SENDER = 'ashish.rai@appnox.ai';
const RECIPIENT = 'kunal.sharma@appnox.ai';

// Address part of a stored value: newer emails keep the name too, e.g. "Ashish Rai" <ashish.rai@appnox.ai>
const addressOf = text => text.match(/[^\s<>"]+@[^\s<>"]+/)?.[0] ?? text;

// Email rows show one address as a level-4 heading: the sender in Inbox, the recipient in Sent
const emailRows = page => page.getByRole('heading', { level: 4 })
  .locator('xpath=ancestor::div[contains(@class,"cursor-pointer")][1]');

// Selects the mailbox in the sidebar unless it is already selected
async function useMailbox(page, mailbox) {
  const selected = page.getByRole('button', { name: /\S+@\S+\.\S+/ }).first();
  await selected.waitFor({ state: 'visible', timeout: 30000 });
  if (!(await selected.innerText()).includes(mailbox)) {
    await selected.click();
    await page.getByRole('button', { name: mailbox }).first().click();
  }
  await expect(selected).toContainText(mailbox);
}

// Opens the sender's Sent folder from the sidebar and returns the emails it loaded (same order as the rows)
async function openSent(page) {
  // Leave Sent first so clicking it loads the list again
  if (/folder=sent/i.test(page.url())) {
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/emails/list?') && r.url().includes('folder=inbox')),
      page.getByRole('button', { name: 'Inbox', exact: true }).click(),
    ]);
  }
  const [list] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/emails/list?') && r.url().includes('folder=sent')
      && decodeURIComponent(r.url()).includes(SENDER)),
    page.getByRole('button', { name: 'Sent', exact: true }).click(),
  ]);
  await expect(page).toHaveURL(/folder=sent/i);
  return (await list.json()).data.emails;
}

test("Sent folder shows the recipient of a sent email", async ({ page }) => {
  test.setTimeout(240000);
  const time = new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const subject = `Sent folder recipient check ${time}`;
  const body = 'Automated test email: checks that the Sent folder shows the recipient. Please ignore.';

  await loginStaging(page);
  await page.locator('a[href="/mail"]').first().click({ timeout: 30000 });
  await page.waitForURL('**/mail**');
  await useMailbox(page, SENDER);

  // Compose from ashish.rai@appnox.ai
  await page.getByRole('button', { name: 'Compose Mail' }).click();
  await expect(page.getByRole('heading', { name: 'New Message', level: 4 })).toBeVisible();
  const from = page.getByRole('combobox').filter({ hasText: '@' }).first();
  if (!(await from.innerText()).includes(SENDER)) {
    await from.click();
    await page.getByRole('option', { name: SENDER }).first().click();
  }
  await expect(from).toContainText(SENDER);

  // Recipient becomes a chip when Enter is pressed (the box loses its placeholder once it has text)
  await page.getByPlaceholder('Add recipients...').fill(RECIPIENT);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape'); // closes the suggestion list
  await expect(page.locator('label', { hasText: /^To$/ }).locator('xpath=..').getByText(RECIPIENT, { exact: true })).toBeVisible();

  await page.getByPlaceholder("What's this about?").fill(subject);
  // Type above the signature (clicking the editor puts the cursor at the end of it)
  await page.locator('.ProseMirror p').first().click();
  await page.keyboard.type(body);
  await page.screenshot({ path: 'screenshots/SentFolderRecipient-1-compose.png' });

  // Send and check what went to the server
  const [sent] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/api/emails/send') && r.request().method() === 'POST', { timeout: 60000 }),
    page.getByRole('button', { name: 'Send', exact: true }).click(),
  ]);
  expect(sent.ok(), `Send API returned ${sent.status()}`).toBeTruthy();
  const request = sent.request().postDataJSON();
  expect(request.from).toBe(SENDER);
  expect(request.to).toEqual([RECIPIENT]);
  expect(request.body).toContain(body);
  await expect.soft(page.getByText('Your email has been sent successfully'), 'Success message should be shown')
    .toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'New Message', level: 4 }), 'Compose should close after sending').toBeHidden();
  console.log(`Sent "${subject}" from ${SENDER} to ${RECIPIENT}`);

  // Sent folder, right after sending: the email is listed with the recipient's address, not the sender's
  let emails;
  await expect(async () => {
    emails = await openSent(page);
    expect(emails.map(e => e.subject)).toContain(subject);
  }, 'Sent email should be listed in Sent').toPass({ timeout: 60000 });
  const saved = emails.find(e => e.subject === subject);
  expect(addressOf(saved.from)).toBe(SENDER);
  expect(saved.to.map(addressOf)).toEqual([RECIPIENT]);

  const row = emailRows(page).filter({ hasText: subject });
  await expect(row).toHaveCount(1);
  const shownAddress = row.getByRole('heading', { level: 4 });
  await expect(shownAddress, 'Sent folder should show the recipient, not the sender').toHaveText(RECIPIENT);
  await expect(row.locator('div.rounded-full.text-white'), "Avatar should show the recipient's initial")
    .toHaveText(RECIPIENT[0].toUpperCase());
  console.log(`Sent folder row shows "${await shownAddress.innerText()}"`);
  await page.screenshot({ path: 'screenshots/SentFolderRecipient-2-sent-folder.png' });

  // Opened email: from the sender, to the recipient
  await row.click();
  await expect(page.getByRole('heading', { name: subject, level: 1 })).toBeVisible();
  await expect(page.getByText(`<${SENDER}>`).first()).toBeVisible();
  await expect(page.getByText(`to ${RECIPIENT}`).first()).toBeVisible();
  await page.screenshot({ path: 'screenshots/SentFolderRecipient-3-opened.png' });

  // Still the recipient after reloading the page
  await page.goto(`${BASE_URL}/mail`);
  await useMailbox(page, SENDER);
  emails = await openSent(page);
  await expect(shownAddress, 'Recipient should still be shown after reload').toHaveText(RECIPIENT);

  // Every listed email shows one of its own recipients, never the sender
  const shown = await emailRows(page).evaluateAll(rows => rows.map(row => {
    const heading = row.querySelector('h4');
    return { address: heading.innerText.trim(), subject: heading.parentElement.nextElementSibling.firstElementChild.innerText.trim() };
  }));
  const wrong = shown.filter(({ address, subject: rowSubject }) => {
    const sameSubject = emails.filter(e => e.subject === rowSubject);
    return !(sameSubject.length ? sameSubject : emails).some(e => e.to.some(to => address.includes(addressOf(to))));
  });
  expect.soft(wrong, 'Every email in Sent should show its recipient').toEqual([]);
  console.log(`Checked ${shown.length} emails in Sent: ${shown.length - wrong.length} show their recipient`);
});
