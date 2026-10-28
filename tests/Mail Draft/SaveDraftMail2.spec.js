const { test, expect } = require('@playwright/test');

test("valid login", async ({ page }) => {
  const sender = "ashish.rai@appnox.ai";
  const recipient = "govind.appnox@gmail.com";
  const subject = "CRM Testing";
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
      await page.waitForTimeout(500);

      const passwordField = page.getByPlaceholder("Password");
      if (!await passwordField.isVisible({ timeout: 5000 })) {
        throw new Error("Password field not visible on login page");
      }
      await passwordField.fill("Ashish@567");
      await page.waitForTimeout(500);

      const submitButton = page.locator("//button[@type='submit']");
      if (!await submitButton.isVisible()) {
        throw new Error("Submit button not found");
      }
      await submitButton.click();
    } catch (error) {
      throw new Error(`Login failed: ${error.message}`);
    }

    // Wait for dashboard to load
    try {
      await page.waitForLoadState("networkidle", { timeout: 10000 });
      await page.waitForTimeout(2000);
    } catch (error) {
      console.warn(`Dashboard networkidle wait exceeded, continuing anyway: ${error.message}`);
      await page.waitForTimeout(3000);
    }

    // Navigate to mail section
    try {
      const mailLink = page.locator('a[href="/mail"]').first();
      await mailLink.waitFor({ state: 'visible', timeout: 10000 });
      await Promise.all([
        page.waitForURL('**/mail'),
        mailLink.click()
      ]);
    } catch (error) {
      throw new Error(`Failed to navigate to Mail: ${error.message}`);
    }

    // Click compose email
    try {
      const composeButton = page.getByRole('button', { name: /Compose Mail/i });
      await composeButton.waitFor({ state: 'visible', timeout: 30000 });
      await composeButton.click();
    } catch (error) {
      throw new Error(`Failed to click Compose Mail: ${error.message}`);
    }

    // Select ashish.rai@appnox.ai in the From field if it is not already selected
    try {
      const fromSelect = page.getByRole('combobox').filter({ has: page.locator('span', { hasText: '@' }) }).first();
      await fromSelect.waitFor({ state: 'visible', timeout: 10000 });
      if (!(await fromSelect.innerText()).includes(sender)) {
        await fromSelect.click();
        await page.getByRole('option', { name: sender }).first().click();
      }
      await expect(fromSelect).toContainText(sender);
    } catch (error) {
      throw new Error(`Failed to select sender ${sender}: ${error.message}`);
    }

    // Enter recipient email
    try {
      const recipientInput = page.getByPlaceholder("Add recipients...");
      if (!await recipientInput.isVisible({ timeout: 5000 })) {
        throw new Error("Recipient email input not found");
      }
      await recipientInput.fill(recipient);
      await page.waitForTimeout(1000);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      // Recipient must be added as a chip
      const toRow = page.locator('label', { hasText: /^To$/ }).locator('xpath=..');
      await expect(toRow.getByText(recipient, { exact: true })).toBeVisible({ timeout: 5000 });

      // Close any suggestion popup that may block the rest of the form
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    } catch (error) {
      throw new Error(`Failed to enter recipient email: ${error.message}`);
    }

    // Enter subject
    try {
      const subjectField = page.getByPlaceholder("What's this about?");
      if (!await subjectField.isVisible({ timeout: 5000 })) {
        throw new Error("Subject field not visible");
      }
      await subjectField.fill(subject);
      await page.waitForTimeout(500);
    } catch (error) {
      throw new Error(`Failed to enter subject: ${error.message}`);
    }

    // Enter email body (first line above the signature)
    try {
      const emailEditor = page.locator('[contenteditable="true"] p').first();
      if (!await emailEditor.isVisible({ timeout: 5000 })) {
        throw new Error("Email editor not visible");
      }
      await emailEditor.click();
      await page.keyboard.type(
        'CRM should allow users to enter a recipient email address in the email input field and add it successfully upon pressing Enter. The system must validate the email format and display appropriate feedback for invalid inputs.'
      );
      await page.waitForTimeout(500);
      await page.keyboard.press('Tab');
      await page.waitForTimeout(300);
    } catch (error) {
      throw new Error(`Failed to enter email body: ${error.message}`);
    }

    // Click Save Draft
    try {
      const saveDraftButton = page.getByRole('button', { name: 'Save Draft' });
      if (!await saveDraftButton.isVisible({ timeout: 5000 })) {
        throw new Error("Save Draft button not visible");
      }
      await saveDraftButton.scrollIntoViewIfNeeded();
      if (!await saveDraftButton.isEnabled()) {
        throw new Error("Save Draft button is disabled (check required fields)");
      }
      await saveDraftButton.click();
      await expect(page.getByText('Draft Saved').first()).toBeVisible({ timeout: 15000 });
      console.log('Draft Saved toast shown.');
      await page.screenshot({ path: 'screenshots/SaveDraftMail2-after-save.png' });
    } catch (error) {
      throw new Error(`Failed to click Save Draft: ${error.message}`);
    }

    // Verify the draft is present in the Drafts folder of the sender mailbox
    try {
      // Switch the sidebar mailbox to the sender account if it is not already selected
      const senderMailbox = page.getByRole('button', { name: sender });
      if (!await senderMailbox.first().isVisible()) {
        await page.getByRole('button', { name: /\S+@\S+\.\S+/ }).first().click();
        await senderMailbox.first().click();
      }

      await page.getByText(/^Drafts$/).first().click();
      await expect(page).toHaveURL(/folder=drafts?/i);
      await page.waitForTimeout(5000);
      await page.screenshot({ path: 'screenshots/SaveDraftMail2-drafts.png' });

      // The newest draft must be for this recipient and subject
      const draftRow = page.locator('div').filter({ hasText: recipient }).filter({ hasText: subject }).last();
      await expect(draftRow).toBeVisible({ timeout: 60000 });
      console.log(`Draft "${subject}" to ${recipient} found in Drafts.`);

      // Open the draft and check it kept the sender, recipient and subject
      const subjectField = page.getByPlaceholder("What's this about?");
      await expect(async () => {
        if (await subjectField.isVisible()) return;
        await draftRow.getByText(subject, { exact: true }).first().click({ timeout: 5000 });
        await expect(subjectField).toBeVisible({ timeout: 5000 });
      }).toPass({ timeout: 30000 });
      const fromSelect = page.getByRole('combobox').filter({ has: page.locator('span', { hasText: '@' }) }).first();
      await expect(fromSelect).toContainText(sender);
      const toRow = page.locator('label', { hasText: /^To$/ }).locator('xpath=..');
      await expect(toRow.getByText(recipient, { exact: true })).toBeVisible();
      await expect(subjectField).toHaveValue(subject);
      await expect(page.locator('[contenteditable="true"]').first()).toContainText('CRM should allow users to enter a recipient email address');
      console.log(`Draft opened: from ${sender} to ${recipient}, subject "${subject}".`);
      await page.screenshot({ path: 'screenshots/SaveDraftMail2-draft-opened.png' });
    } catch (error) {
      await page.screenshot({ path: 'screenshots/SaveDraftMail2-draft-verify-failed.png' });
      throw new Error(`Draft verification failed: ${error.message}`);
    }

    // Take final screenshot
    await page.screenshot({ path: 'screenshots/SaveDraftMail2-end.png' });

  } catch (error) {
    console.error("Test error:", error.message);
    throw error;
  }
});
