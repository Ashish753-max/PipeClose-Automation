const { test, expect } = require('@playwright/test');

test("valid login", async ({ page }) => {
  const sender = "ashish.rai@appnox.ai";
  const recipient = "kunal.sharma@appnox.ai";
  const subject = "CRM Testing";
    try {
    // Navigate to application with error handling
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
            await page.waitForTimeout(1000);

    // Login with validation  
    try {
      const emailField = page.getByPlaceholder("Email");
      if (!await emailField.isVisible({ timeout: 5000 })) {
        throw new Error("Email field not visible on login page");
      }
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



    // Click compose email with validation
    try {
  const composeButton = page.getByRole('button', { name: /Compose Mail/i });

  await composeButton.waitFor({ state: 'visible', timeout: 30000 });
  await composeButton.click();

} catch (error) {
  throw new Error(`Failed to click Compose Mail: ${error.message}`);
}


/* // click on select sender 
  await page.getByText("Select sender").click();
    await page.waitForTimeout(1000)

 // select the email
  await page.getByText("Active").click();   */

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

    // Enter recipient email with error handling
    try {
      const recipientInput = page.getByPlaceholder("Add recipients...");
      if (!await recipientInput.isVisible({ timeout: 5000 })) {
        throw new Error("Recipient email input not found");
      }
      await recipientInput.fill(recipient);
      await page.waitForTimeout(1000);
    
      // Press Enter to add recipient
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      // Recipient must be added as a chip and the input cleared
      const toRow = page.locator('label', { hasText: /^To$/ }).locator('xpath=..');
      await expect(toRow.getByText(recipient, { exact: true })).toBeVisible({ timeout: 5000 });

      // Close any suggestion popup that may block the rest of the form
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    } catch (error) {
      throw new Error(`Failed to enter recipient email: ${error.message}`);
    }


    // Enter the subject with error handling
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

    // Enter the description with error handling
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
      // Move focus out of the rich-text editor so buttons become clickable
      await page.keyboard.press('Tab');
      await page.waitForTimeout(300);
    } catch (error) {
      throw new Error(`Failed to enter email body: ${error.message}`);
    }

    // Click send with error handling
    try {
            const sendButton = page.getByRole('button', { name: 'Send', exact: true });
      if (!await sendButton.isVisible({ timeout: 5000 })) {
        throw new Error("Send button not visible");
      }
      await sendButton.scrollIntoViewIfNeeded();
      if (!await sendButton.isEnabled()) {
        throw new Error("Send button is disabled (check required fields)");
      }
      try {
        await sendButton.click({ timeout: 5000 });
      } catch (clickError) {
        console.warn('Click failed, trying force click:', clickError.message);
        await sendButton.click({ force: true });
      }
      
      // Verify email was sent successfully
      await page.waitForTimeout(2000);
      const successMsg = page.locator('text=Email sent|Success|Sent successfully');
      if (!await successMsg.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.warn("Success message not found, but email may have been sent");
        await page.screenshot({ path: 'screenshots/email-send-failure2.png' });
      } else {
        await page.screenshot({ path: 'screenshots/email-sent.png' });
      }
    } catch (error) {
      await page.screenshot({ path: 'screenshots/email-send-error.png' });
      throw new Error(`Failed to send email: ${error.message}`);
    }

    //  await page.waitForTimeout(9000);


    // Verify the email is present in the Sent folder with the correct recipient
    try {
      // Wait for the send confirmation toast, then let it close so it isn't matched below
      const toast = page.getByText('Your email has been sent successfully');
      await toast.waitFor({ state: 'visible', timeout: 15000 });
      await toast.waitFor({ state: 'hidden', timeout: 20000 }).catch(() => {});

      // Switch the sidebar mailbox to the sender account if it is not already selected
      const senderMailbox = page.getByRole('button', { name: sender });
      if (!await senderMailbox.first().isVisible()) {
        await page.getByRole('button', { name: /\S+@\S+\.\S+/ }).first().click();
        await senderMailbox.first().click();
      }

      await page.getByText(/^Sent$/).first().click();
      await expect(page).toHaveURL(/folder=sent/i);

      // Open the newest matching email at the top of the Sent list
      const sentEmail = page.getByText(subject, { exact: true }).first();
      await expect(sentEmail).toBeVisible({ timeout: 60000 });
      // The live list can re-render during the click, so retry until the email opens
      await expect(async () => {
        if (await page.getByText(`<${sender}>`).first().isVisible()) return;
        await sentEmail.click({ timeout: 5000 });
        await expect(page.getByText(`<${sender}>`).first()).toBeVisible({ timeout: 5000 });
      }).toPass({ timeout: 30000 });

      // The sender and recipient email addresses must be shown in the opened email
      await expect(page.getByText(`<${sender}>`).first()).toBeVisible({ timeout: 20000 });
      await expect(page.getByText(`to ${recipient}`).first()).toBeVisible({ timeout: 20000 });
      console.log(`Email "${subject}" found in Sent folder, from ${sender} to ${recipient}.`);
      await page.screenshot({ path: 'screenshots/SendMail1-sent-verified.png' });
    } catch (error) {
      await page.screenshot({ path: 'screenshots/SendMail1-sent-verify-failed.png' });
      throw new Error(`Sent email verification failed: ${error.message}`);
    }

    // Take final screenshot
    await page.screenshot({ path: 'screenshots/SendMail1-end.png' });

  } catch (error) {
    console.error("Test error:", error.message);
    throw error;
  }

});

