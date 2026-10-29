// tests/common/summarizeEmail.js
// Shared flow for the Summarizer Email scripts (tests/Summarizer Email/*.spec.js)
const { expect } = require('@playwright/test');
const { loginStaging } = require('./createDeal');

/**
 * Opens the Nth email of the Inbox (0 = latest), runs the Summarizer and verifies the summary.
 * @param {import('@playwright/test').Page} page
 * @param {number} index position of the email in the Inbox list
 * @param {string} screenshot file name in screenshots/
 */
async function summarizeEmail(page, index, screenshot) {
  await loginStaging(page);

  // Go to Mail > Inbox
  await page.locator('a[href="/mail"]').first().click({ timeout: 30000 });
  await page.waitForURL('**/mail**');
  await page.getByRole('button', { name: 'Inbox', exact: true }).click();

  // Email rows contain the sender as a level-4 heading
  const emailRows = page.getByRole('heading', { level: 4 })
    .locator('xpath=ancestor::div[contains(@class,"cursor-pointer")][1]');
  await emailRows.first().waitFor({ state: 'visible', timeout: 30000 });
  expect(await emailRows.count(), `Inbox should have at least ${index + 1} emails`).toBeGreaterThan(index);

  // Open the email and make sure the right one is shown ("2 / 42" for the second email)
  await emailRows.nth(index).click();
  await expect(page.getByRole('button', { name: 'Back to Inbox' })).toBeVisible();
  await expect(page.getByText(new RegExp(`^${index + 1} / \\d+$`))).toBeVisible();
  const subject = (await page.getByRole('heading', { level: 1 }).first().innerText()).trim();
  console.log(`Email #${index + 1}: "${subject}"`);

  // Click Summarizer (not shown if this thread already has a summary)
  const summarizer = page.getByRole('button', { name: 'Summarizer' });
  const summaryResponse = page.waitForResponse(
    r => r.url().includes('/api/summarization/threads/') && r.request().method() === 'GET'
      && r.ok() && r.text().then(t => t.includes('"status":"completed"')).catch(() => false),
    { timeout: 180000 }
  );
  if (await summarizer.isVisible()) {
    await summarizer.click();
    await expect(page.getByRole('heading', { name: 'AI is analyzing conversation...' }), 'Loading state should show')
      .toBeVisible({ timeout: 10000 });
  }

  // Wait for the AI to finish and the panel to show the result
  const { data } = await (await summaryResponse).json();
  await expect(page.getByText('Analysis Complete')).toBeVisible({ timeout: 30000 });

  // Verify the summary sections are displayed and not empty
  const summaryHeading = page.getByRole('heading', { name: 'AI Summary', level: 4 });
  await expect(summaryHeading).toBeVisible();
  const summaryItems = summaryHeading.locator('xpath=following::ul[1]/li');
  await expect(summaryItems.first()).not.toBeEmpty();
  await expect(page.getByRole('heading', { name: 'Key Points', level: 4 })).toBeVisible();

  // The displayed summary must match what the API returned
  const apiSummary = data.summary.text.split('\n')[0].replace(/^[-•]\s*/, '').trim();
  expect(apiSummary.length, 'API summary should not be empty').toBeGreaterThan(0);
  await expect(summaryItems.first()).toContainText(apiSummary.slice(0, 60));

  console.log(`Summary: ${await summaryItems.first().innerText()}`);
  await page.screenshot({ path: `screenshots/${screenshot}` });
}

module.exports = summarizeEmail;
