// tests/common/mail.js
// Helpers for the Mail pages (used by the Star email and Campaign scripts)
const { expect } = require('@playwright/test');

// All email rows in the open list. Each row shows one address as a level-4 heading (the sender in Inbox, the
// recipient in Sent); the row is the nearest clickable box ("cursor-pointer") around that heading.
function emailRows(page) {
  return page.getByRole('heading', { level: 4 }).locator('xpath=ancestor::div[contains(@class,"cursor-pointer")][1]');
}

// True when the response is the email list of a folder ('inbox' or 'sent') of the mailbox
function isEmailList(response, folder, mailbox) {
  if (!response.url().includes('/api/emails/list?')) return false;
  const params = new URL(response.url()).searchParams;
  const accountId = params.get('accountId') || ''; // e.g. "2-ashish.rai@appnox.ai"
  return params.get('folder') === folder && accountId.endsWith(mailbox);
}

// Opens Mail from the sidebar. Right after login, first wait for the Deals page: a sidebar click before that is lost.
async function openMail(page) {
  await page.locator('a[href="/mail"]').first().click({ timeout: 30000 });
  await page.waitForURL('**/mail**');
}

// Selects a mailbox in the Mail sidebar, unless it is already selected
async function useMailbox(page, mailbox) {
  // The selected mailbox is shown on a button that reads its address
  const selected = page.getByRole('button', { name: /\S+@\S+\.\S+/ }).first();
  await selected.waitFor({ timeout: 30000 });
  const selectedText = await selected.innerText();
  if (!selectedText.includes(mailbox)) {
    await selected.click();
    await page.getByRole('button', { name: mailbox }).first().click();
  }
  await expect(selected).toContainText(mailbox);
}

// Opens the mailbox's Sent folder and returns the emails it loaded (in the same order as the rows)
async function openSent(page, mailbox) {
  // Clicking Sent while it is open does not load it again, so go to Inbox first
  if (page.url().includes('folder=sent')) {
    await Promise.all([
      page.waitForResponse(res => isEmailList(res, 'inbox', mailbox)),
      page.getByRole('button', { name: 'Inbox', exact: true }).click(),
    ]);
  }
  const [response] = await Promise.all([
    page.waitForResponse(res => isEmailList(res, 'sent', mailbox)),
    page.getByRole('button', { name: 'Sent', exact: true }).click(),
  ]);
  await expect(page).toHaveURL(/folder=sent/);
  const body = await response.json();
  return body.data.emails;
}

// Scrolls the email list until the row is drawn. The list only draws the rows in view (about nine on a 720px
// high screen), so an older email has no row until the list is scrolled down to it.
async function scrollToEmailRow(page, row) {
  for (let attempt = 0; attempt < 30; attempt++) {
    if (await row.count() > 0) return;
    await emailRows(page).last().scrollIntoViewIfNeeded();
    await page.waitForTimeout(500); // give the list time to draw the next rows
  }
  expect(await row.count(), 'The email should be in the list').toBeGreaterThan(0);
}

module.exports = { emailRows, isEmailList, openMail, useMailbox, openSent, scrollToEmailRow };
