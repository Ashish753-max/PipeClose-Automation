// tests/common/aiReply.js
// Shared flow for the AI Reply scripts (tests/AI Reply/*.spec.js)
const { expect } = require('@playwright/test');
const { loginStaging } = require('./createDeal');

/**
 * Opens the Nth email of the Inbox (0 = latest), generates an AI Reply and verifies the draft.
 * The draft is closed without sending.
 * @param {import('@playwright/test').Page} page
 * @param {number} index position of the email in the Inbox list
 * @param {string} screenshot file name in screenshots/
 */
async function aiReply(page, index, screenshot) {
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
  // Sender is shown as "name <address>"; the last message in the thread is the one replied to
  const senderText = await page.getByText(/<\S+@\S+>/).last().innerText();
  const sender = senderText.match(/<(\S+@\S+)>/)[1];
  console.log(`Email #${index + 1}: "${subject}" from ${sender}`);

  // AI Reply opens the "Generate AI Reply" dialog for this email
  await page.getByRole('button', { name: 'AI Reply', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Generate AI Reply', level: 3 })).toBeVisible();
  await expect(page.getByText(`Replying to: ${subject}`)).toBeVisible();

  // Generate the reply and wait for the AI
  const [suggestResponse] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/ai/suggest') && r.request().method() === 'POST', { timeout: 180000 }),
    page.getByRole('button', { name: 'Generate Reply' }).click(),
  ]);
  expect(suggestResponse.ok(), `AI suggest API returned ${suggestResponse.status()}`).toBeTruthy();
  const suggestion = await suggestResponse.json();

  // The new draft is shown with recipient, subject and AI body filled in
  await expect(page.getByText('New Message', { exact: true }), 'Draft should open').toBeVisible({ timeout: 30000 });
  const toChip = page.getByText(/^to$/i).locator('xpath=following::*[contains(normalize-space(.), "@")][1]');
  await expect(toChip, 'Reply should go to the original sender').toContainText(sender);
  await expect(page.getByPlaceholder("What's this about?")).toHaveValue(`Re: ${subject}`);

  const body = page.locator('.ProseMirror');
  await expect(body, 'AI draft body should not be empty').not.toBeEmpty();
  expect(suggestion.body.trim().length, 'AI suggestion should not be empty').toBeGreaterThan(0);
  // Compare with whitespace normalized: the editor splits the text into paragraphs
  const normalize = t => t.replace(/\s+/g, '');
  const expectedStart = normalize(suggestion.body).slice(0, 50);
  await expect.poll(async () => normalize(await body.innerText()), 'Draft should contain the AI reply')
    .toContain(expectedStart);
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save Draft' })).toBeVisible();

  console.log(`AI draft: ${(await body.innerText()).trim()}`);
  await page.screenshot({ path: `screenshots/${screenshot}` });

  // Close the draft without sending
  await page.getByTestId('compose-backdrop').getByRole('button', { name: 'Close' }).click();
  await expect(page.getByText('New Message', { exact: true })).toBeHidden();
}

module.exports = aiReply;
