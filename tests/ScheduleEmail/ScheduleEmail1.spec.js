const { test, expect } = require('@playwright/test');

test("valid login", async function ({ page }) {

    try {
    // Navigate to application with error handling
    try {
      await page.goto("https://pipeclose.com/", { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');
    } catch (error) {
      throw new Error(`Failed to navigate to website: ${error.message}`);
    }
        await page.getByRole('button', { name: 'Log in', exact: true }).click();

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

    // Wait for 5 seconds to ensure dashboard is loaded, then take final screenshot
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'screenshots/CRM Login-end.png' });

  } catch (error) {
    console.error("Test error:", error.message);
    throw error;
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

  await composeButton.waitFor({ state: 'visible', timeout: 10000 });
  await composeButton.click();

} catch (error) {
  throw new Error(`Failed to click Compose Mail: ${error.message}`);
}


/* // click on select sender 
  await page.getByText("Select sender").click();
    await page.waitForTimeout(1000)

 // select the email
  await page.getByText("Active").click();   */

    // Enter recipient email with error handling
    try {
      const recipientInput = page.getByPlaceholder("Add recipients...");
      if (!await recipientInput.isVisible({ timeout: 5000 })) {
        throw new Error("Recipient email input not found");
      }
      await recipientInput.fill('kunal.sharma@appnox.ai');
      await page.waitForTimeout(1000);
    
      // Press Enter to add recipient
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
    } catch (error) {
      throw new Error(`Failed to enter recipient email: ${error.message}`);
    }


    // Enter the subject with error handling
    try {
      const subjectField = page.getByPlaceholder("What's this about?");
      if (!await subjectField.isVisible({ timeout: 5000 })) {
        throw new Error("Subject field not visible");
      }
      await subjectField.fill("CRM Testing");
      await page.waitForTimeout(500);
    } catch (error) {
      throw new Error(`Failed to enter subject: ${error.message}`);
    }

    // Enter the description with error handling
    try {
      const emailEditor = page.locator('p[data-placeholder="Write your message here..."]');
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

    // click on the schedule button 
    await page.getByLabel('Send options').click();


});

