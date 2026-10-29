const { test, expect } = require('@playwright/test');

test("Move email from Inbox to Spam using hover spam icon", async ({ page }) => {
  test.setTimeout(180000);
  const mailbox = "ashish.rai@appnox.ai";

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

  try {
    // Navigate to application
    try {
      await page.goto("https://staging.pipeclose.com/", { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');
    } catch (error) {
      throw new Error(`Failed to navigate to website: ${error.message}`);
    }

    // Dismiss cookie consent if shown
    const acceptCookies = page.getByRole('button', { name: 'Accept', exact: true });
    await acceptCookies.click({ timeout: 5000 }).catch(() => {});

    // Open login form unless it is already shown
    const loginBtn = page.getByRole('button', { name: 'Log in', exact: true });
    const emailInput = page.getByPlaceholder("Email");
    await loginBtn.or(emailInput).first().waitFor({ state: 'visible', timeout: 15000 });
    if (await loginBtn.isVisible()) await loginBtn.click();

    // Login
    try {
      const emailField = page.getByPlaceholder("Email");
      await emailField.waitFor({ state: 'visible', timeout: 15000 })
        .catch(() => { throw new Error("Email field not visible on login page"); });
      await emailField.fill("ashishappnox1@gmail.com");
      await page.getByPlaceholder("Password").fill("Ashish@567");
      await page.locator("//button[@type='submit']").click();
    } catch (error) {
      throw new Error(`Login failed: ${error.message}`);
    }

    // Navigate to mail section
    try {
      const mailLink = page.locator('a[href="/mail"]').first();
      await mailLink.waitFor({ state: 'visible', timeout: 30000 });
      await Promise.all([
        page.waitForURL('**/mail'),
        mailLink.click()
      ]);
    } catch (error) {
      throw new Error(`Failed to navigate to Mail: ${error.message}`);
    }

    // Switch the sidebar mailbox to ashish.rai@appnox.ai if it is not already selected
    try {
      const anyMailbox = page.getByRole('button', { name: /\S+@\S+\.\S+/ }).first();
      await anyMailbox.waitFor({ state: 'visible', timeout: 30000 });
      const targetMailbox = page.getByRole('button', { name: mailbox });
      if (!await targetMailbox.first().isVisible()) {
        await anyMailbox.click();
        await targetMailbox.first().click();
      }
      await expect(page.getByRole('button', { name: mailbox }).first()).toBeVisible();
    } catch (error) {
      throw new Error(`Failed to switch to mailbox ${mailbox}: ${error.message}`);
    }

    // Read the Spam total before marking as spam
    let spamBefore;
    try {
      await page.getByRole('button', { name: /^Spam/ }).first().click();
      await expect(page).toHaveURL(/folder=spam/i);
      await page.waitForTimeout(3000);
      spamBefore = await readTotal();
      console.log(`Spam total before: ${spamBefore}`);
    } catch (error) {
      throw new Error(`Failed to open Spam: ${error.message}`);
    }

    // Open Inbox and record the first email's details
    let inboxBefore, emailSender, emailSubject, emailTime;
    const firstRow = emailRows.first();
    try {
      await page.getByRole('button', { name: /^Inbox/ }).first().click();
      await expect(page).not.toHaveURL(/folder=spam/i);
      await page.waitForTimeout(3000);
      await expect(firstRow).toBeVisible({ timeout: 30000 });
      inboxBefore = await readTotal();

      emailSender = (await firstRow.getByRole('heading', { level: 4 }).innerText()).trim();
      // Subject is the first item in the block that follows the sender heading
      emailSubject = (await firstRow.evaluate(row => {
        let node = row.querySelector('h4');
        while (node && !node.nextElementSibling) node = node.parentElement;
        const block = node.nextElementSibling;
        return (block.firstElementChild || block).innerText;
      })).trim();
      emailTime = (await firstRow.getByText(/^\s*(\d{1,2}:\d{2}\s*[AP]M|Yesterday|[A-Z][a-z]{2} \d{1,2})\s*$/).first().innerText()).trim();
      console.log(`Inbox total before: ${inboxBefore}`);
      console.log(`Email to mark as spam: from "${emailSender}", subject "${emailSubject}", time "${emailTime}"`);
      await page.screenshot({ path: 'screenshots/InboxToSpam-1-inbox-before.png' });
    } catch (error) {
      throw new Error(`Failed to read Inbox: ${error.message}`);
    }

    // Hover the email and click the spam icon
    try {
      await firstRow.hover();
      const spamIcon = firstRow.getByRole('button', { name: 'Mark as spam', exact: true });
      await expect(spamIcon).toBeVisible({ timeout: 5000 });
      await page.screenshot({ path: 'screenshots/InboxToSpam-2-hover-actions.png' });
      await spamIcon.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'screenshots/InboxToSpam-3-after-spam.png' });
    } catch (error) {
      throw new Error(`Failed to mark email as spam from hover actions: ${error.message}`);
    }

    // The Inbox must have one email less
    try {
      await expect.poll(readTotal, { timeout: 30000 }).toBe(inboxBefore - 1);
      console.log(`Inbox total after: ${inboxBefore - 1}`);
    } catch (error) {
      throw new Error(`Inbox count did not decrease: ${error.message}`);
    }

    // The email must be in Spam and the Spam total must increase by one
    try {
      await page.getByRole('button', { name: /^Spam/ }).first().click();
      await expect(page).toHaveURL(/folder=spam/i);
      await expect.poll(readTotal, { timeout: 30000 }).toBe(spamBefore + 1);
      console.log(`Spam total after: ${spamBefore + 1}`);

      // Match on subject and time (the Inbox list can show a different sender than Spam)
      const spammedEmail = emailRows
        .filter({ hasText: emailSubject })
        .filter({ hasText: emailTime });
      await expect(spammedEmail.first()).toBeVisible({ timeout: 30000 });
      await spammedEmail.first().scrollIntoViewIfNeeded();
      const spamSender = (await spammedEmail.first().getByRole('heading', { level: 4 }).innerText()).trim();
      if (spamSender !== emailSender) {
        console.warn(`WARNING: sender differs - Inbox showed "${emailSender}", Spam shows "${spamSender}"`);
      }
      console.log(`Email "${emailSubject}" (${emailTime}) found in Spam, sender "${spamSender}".`);
      await page.screenshot({ path: 'screenshots/InboxToSpam-4-spam-verified.png' });
    } catch (error) {
      await page.screenshot({ path: 'screenshots/InboxToSpam-spam-verify-failed.png' });
      throw new Error(`Email not found in Spam: ${error.message}`);
    }

  } catch (error) {
    console.error("Test error:", error.message);
    throw error;
  }
});
