const { test, expect } = require('@playwright/test');
const { loginStaging } = require('../common/createDeal');

test("Mark Inbox email as unread using hover button", async ({ page }) => {
  test.setTimeout(180000);

  // Reads the total from the list header, e.g. "1-50 of 109" -> 109 (empty folder -> 0)
  const readTotal = async () => {
    const header = page.getByText(/^\s*\d+-\d+\s*of\s*\d+\s*$/).first();
    const emptyFolder = page.getByRole('heading', { name: 'Nothing here' });
    await header.or(emptyFolder).first().waitFor({ state: 'visible', timeout: 30000 });
    if (await emptyFolder.isVisible()) return 0;
    return parseInt((await header.innerText()).match(/of\s*(\d+)/)[1], 10);
  };

  // Email rows contain the sender as a level-4 heading
  const emailRows = page.getByRole('heading', { level: 4 })
    .locator('xpath=ancestor::div[contains(@class,"cursor-pointer")][1]');
  const firstRow = emailRows.first();
  const sender = firstRow.getByRole('heading', { level: 4 });

  // Unread email: sender in bold + blue left border, hover button offers "Mark as read"
  const expectUnread = async () => {
    await expect(sender).toHaveClass(/font-bold/);
    await expect(firstRow).toHaveClass(/border-l-primary/);
    await firstRow.hover();
    await expect(firstRow.getByRole('button', { name: 'Mark as read', exact: true })).toBeVisible();
  };
  // Read email: sender not bold, no blue border, hover button offers "Mark as unread"
  const expectRead = async () => {
    await expect(sender).not.toHaveClass(/font-bold/);
    await expect(firstRow).not.toHaveClass(/border-l-primary/);
    await firstRow.hover();
    await expect(firstRow.getByRole('button', { name: 'Mark as unread', exact: true })).toBeVisible();
  };

  // Clicks a hover button and waits for the read/unread update to be saved
  const clickReadToggle = async (name) => {
    await firstRow.hover();
    const [response] = await Promise.all([
      page.waitForResponse(r => /\/api\/emails\/[^/]+\/read/.test(r.url()) && r.request().method() === 'PATCH'),
      firstRow.getByRole('button', { name, exact: true }).click(),
    ]);
    expect(response.ok(), `Read status API returned ${response.status()}`).toBeTruthy();
  };

  const openFilter = async (name) => {
    await page.getByRole('button', { name, exact: true }).click();
    await page.waitForTimeout(2000);
  };

  // Login and open Inbox
  await loginStaging(page);
  await page.locator('a[href="/mail"]').first().click({ timeout: 30000 });
  await page.waitForURL('**/mail**');
  await page.getByRole('button', { name: 'Inbox', exact: true }).click();
  await expect(firstRow).toBeVisible({ timeout: 30000 });

  // Start from a read email
  await firstRow.hover();
  if (await firstRow.getByRole('button', { name: 'Mark as read', exact: true }).isVisible()) {
    await clickReadToggle('Mark as read');
  }
  await expectRead();

  const subject = (await firstRow.evaluate(row => {
    let node = row.querySelector('h4');
    while (node && !node.nextElementSibling) node = node.parentElement;
    const block = node.nextElementSibling;
    return (block.firstElementChild || block).innerText;
  })).trim();
  console.log(`Email: from "${(await sender.innerText()).trim()}", subject "${subject}"`);

  await openFilter('Unread');
  const unreadBefore = await readTotal();
  await openFilter('All mail');
  console.log(`Unread total before: ${unreadBefore}`);
  await page.screenshot({ path: 'screenshots/MarkAsUnread-1-read.png' });

  // Hover and click "Mark as unread"
  await clickReadToggle('Mark as unread');
  await expectUnread();
  await page.screenshot({ path: 'screenshots/MarkAsUnread-2-unread.png' });

  // Unread filter count goes up by one and lists the email
  await openFilter('Unread');
  await expect.poll(readTotal, { timeout: 30000 }).toBe(unreadBefore + 1);
  await expect(emailRows.filter({ hasText: subject }).first()).toBeVisible();
  console.log(`Unread total after: ${unreadBefore + 1}`);
  await openFilter('All mail');

  // The unread state is saved: it stays after reloading the page
  await page.reload();
  await expect(firstRow).toBeVisible({ timeout: 30000 });
  await expect(firstRow).toContainText(subject);
  await expectUnread();
  await page.screenshot({ path: 'screenshots/MarkAsUnread-3-after-reload.png' });

  // Put the email back to read
  await clickReadToggle('Mark as read');
  await expectRead();
  await openFilter('Unread');
  await expect.poll(readTotal, { timeout: 30000 }).toBe(unreadBefore);
  console.log(`Unread total restored: ${unreadBefore}`);
});
