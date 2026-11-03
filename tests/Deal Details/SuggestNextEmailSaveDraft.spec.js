const { test, expect } = require('@playwright/test');
const { openNewDeal } = require('../common/dealDetails');

// Suggest Next Email on a deal, send the suggestion from ashish.rai@appnox.ai and Save Draft,
// then check the draft is in that mailbox's Drafts folder in Mail with the same sender, recipient, subject and body.
const sender = 'ashish.rai@appnox.ai';

// Compare text with whitespace removed: the editor and the mail list split the body differently
const normalize = text => text.replace(/\s+/g, '');

test('Deal details - Suggest Next Email, Save Draft, draft shows in Mail Drafts', async ({ page }) => {
  test.setTimeout(600000);
  const shot = step => page.screenshot({ path: `screenshots/SuggestNextEmailSaveDraft-${step}.png` });
  const person = await openNewDeal(page);
  const main = page.getByRole('main');
  await page.waitForTimeout(3000); // AI analysis re-renders the page when a deal is first opened

  // Suggest Next Email
  const [response] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/api/ai/suggest') && r.request().method() === 'POST', { timeout: 240000 }),
    main.getByRole('button', { name: 'Suggest Next Email', exact: true }).click(),
  ]);
  if (response.status() !== 201) {
    await shot('suggest-failed');
    throw new Error(`Suggest Next Email returned ${response.status()}: ${await response.text()}`);
  }
  const suggestion = await response.json();
  const subject = suggestion.subjectLine;
  console.log(`Suggested "${subject}"`);
  const popup = page.getByTestId('compose-backdrop');
  await expect(popup.getByRole('heading', { name: 'Review suggested email' })).toBeVisible({ timeout: 30000 });
  await expect(popup.getByPlaceholder("What's this about?")).toHaveValue(subject);
  await shot('1-suggested');

  // Send it from ashish.rai@appnox.ai
  const from = popup.getByRole('combobox').filter({ has: page.locator('span', { hasText: '@' }) }).first();
  if (!(await from.innerText()).includes(sender)) {
    await from.click();
    await page.getByRole('option', { name: sender }).first().click();
  }
  await expect(from).toContainText(sender);

  // Changing the sender swaps in its signature, which edits the AI email, so it must be reviewed before saving
  // (the banner shows once the signature has loaded)
  const saveDraft = popup.getByRole('button', { name: 'Save Draft', exact: true });
  const markReviewed = popup.getByRole('button', { name: 'Mark as reviewed' });
  await expect(markReviewed, 'Changing the sender should ask for a review').toBeVisible({ timeout: 15000 });
  await expect(saveDraft, 'Save Draft should wait for the review').toBeDisabled();
  await markReviewed.click();
  await expect(saveDraft).toBeEnabled();
  await shot('2-from-ashish');

  // Save Draft
  const [saved] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/api/email/drafts') && r.request().method() === 'POST', { timeout: 30000 }),
    saveDraft.click({ timeout: 10000 }),
  ]);
  expect(saved.status(), `Save draft API returned ${saved.status()}`).toBe(201);
  const draft = (await saved.json()).data;
  const recipient = draft.to[0];
  console.log(`Draft ${draft.id} saved from ${draft.from} to ${recipient}`);
  expect(draft.from, 'Draft should be from the chosen sender').toBe(sender);
  expect(draft.subject).toBe(subject);
  expect(recipient, 'Draft should be to the deal person').toMatch(/^deal\.details\+\d+@gmail\.com$/);
  await expect(popup, 'Popup should close after saving').toBeHidden();
  await expect(main.getByRole('button', { name: 'Drafts (1)' }), 'Deal history should count the draft').toBeVisible();
  await shot('3-saved');

  // Mail > ashish.rai@appnox.ai > Drafts
  await Promise.all([page.waitForURL('**/mail**'), page.locator('a[href="/mail"]').first().click()]);
  const mail = page.getByRole('main');
  const mailbox = mail.getByRole('button', { name: /\S+@\S+ imap$/i }).first();
  await expect(mailbox).toBeVisible({ timeout: 30000 });
  if (!(await mailbox.innerText()).includes(sender)) {
    await mailbox.click();
    await mail.getByRole('button', { name: new RegExp(`^\\S ${sender}$`) }).click();
  }
  await expect(mailbox).toContainText(sender);
  await mail.getByRole('navigation').getByRole('button', { name: 'Drafts', exact: true }).click();
  await expect(page).toHaveURL(/folder=drafts?/i);

  // The draft is listed under its recipient, with the sender, subject and AI body
  const row = mail.locator('div')
    .filter({ has: page.getByRole('heading', { name: recipient, level: 4 }) })
    .filter({ hasText: subject }).last();
  await expect(row, `Draft "${subject}" should be in ${sender} Drafts`).toBeVisible({ timeout: 60000 });
  await expect(row).toContainText(`from ${sender}`);
  await expect(row).toContainText(`Hi ${person}`);
  expect(normalize(await row.innerText())).toContain(normalize(suggestion.body).slice(0, 60));
  console.log(`Draft "${subject}" to ${recipient} found in ${sender} Drafts`);
  await shot('4-mail-drafts');

  // Open it: sender, recipient, subject and body are kept
  const subjectField = page.getByPlaceholder("What's this about?");
  await expect(async () => {
    if (await subjectField.isVisible()) return;
    await row.getByText(subject).first().click({ timeout: 5000 });
    await expect(subjectField).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout: 30000 });
  await expect(subjectField).toHaveValue(subject);
  await expect(page.getByRole('combobox').filter({ has: page.locator('span', { hasText: '@' }) }).first()).toContainText(sender);
  const toRow = page.locator('label', { hasText: /^To$/ }).locator('xpath=..');
  await expect(toRow.getByText(recipient)).toBeVisible();
  const editor = page.locator('[contenteditable="true"]').first();
  await expect.poll(async () => normalize(await editor.innerText()), 'Opened draft should have the AI body')
    .toContain(normalize(suggestion.body).slice(0, 60));
  console.log('Draft opened with the same sender, recipient, subject and body');
  await shot('5-draft-opened');
});
