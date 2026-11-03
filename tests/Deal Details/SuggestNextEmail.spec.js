const { test, expect } = require('@playwright/test');
const { openNewDeal, editField } = require('../common/dealDetails');

// Compare text with whitespace removed: the editor splits the AI body into paragraphs
const normalize = text => text.replace(/\s+/g, '');

/**
 * Clicks a Suggest Next Email control, waits for the AI and checks the "Review suggested email" popup.
 * Closes the popup without sending.
 */
async function checkSuggestion(page, person, mode, trigger) {
  const [response] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/api/ai/suggest') && r.request().method() === 'POST', { timeout: 240000 }),
    trigger(),
  ]);
  const request = response.request().postDataJSON();
  console.log(`[${mode}] request:`, JSON.stringify(request));
  if (response.status() !== 201) console.log(`[${mode}] response ${response.status()}:`, await response.text());
  expect(response.status(), `Suggest API returned ${response.status()}`).toBe(201);
  expect(request.generationMode).toBe(mode);
  expect(request.dealId, 'Request should be for this deal').toBe(Number(page.url().match(/\/deals\/(\d+)/)[1]));
  const suggestion = await response.json();
  console.log(`[${mode}] "${suggestion.subjectLine}" (${suggestion.emailType}, QA ${suggestion.qaRelease?.releaseDecision})`);
  expect(suggestion.subjectLine?.trim(), 'AI subject should not be empty').toBeTruthy();
  expect(suggestion.body?.trim(), 'AI body should not be empty').toBeTruthy();

  // Popup shows the suggestion ready to send to the deal's person
  const popup = page.getByTestId('compose-backdrop');
  await expect(popup.getByRole('heading', { name: 'Review suggested email' })).toBeVisible({ timeout: 30000 });
  await expect(popup.getByText('Automated QA passed'), 'QA badge should show').toBeVisible();
  await expect(popup.getByText(/deal\.details\+\d+@gmail\.com/), 'To should be the deal person').toBeVisible();
  await expect(popup.getByPlaceholder("What's this about?")).toHaveValue(suggestion.subjectLine);
  const body = popup.locator('.ProseMirror');
  await expect.poll(async () => normalize(await body.innerText()), 'Popup should show the AI body')
    .toContain(normalize(suggestion.body).slice(0, 60));
  const text = await body.innerText();
  expect.soft(text, 'Greeting should use the person name').toContain(person);
  expect.soft(text, 'No unfilled placeholders').not.toMatch(/\[[^\]]*(name|company|date)[^\]]*\]|\{\{/i);
  for (const name of ['Send', 'Save Draft', 'AI Refine']) {
    await expect(popup.getByRole('button', { name, exact: true })).toBeVisible();
  }
  await page.screenshot({ path: `screenshots/SuggestNextEmail-${mode}.png` });

  // Close without sending
  await popup.getByRole('button', { name: 'Close' }).click();
  await expect(popup).toBeHidden();
}

test('Deal details - Suggest Next Email (standard and Deep Research)', async ({ page }) => {
  test.setTimeout(600000);
  const person = await openNewDeal(page);
  const main = page.getByRole('main');
  await page.waitForTimeout(3000); // AI analysis re-renders the page when a deal is first opened

  const suggest = main.getByRole('button', { name: 'Suggest Next Email', exact: true });
  await expect(suggest).toBeEnabled();
  await checkSuggestion(page, person, 'standard', () => suggest.click());
  await expect(main.getByPlaceholder("What's this about?"), 'Closing the popup should leave the deal composer empty').toHaveValue('');

  // The arrow beside it offers Deep Research
  await main.getByRole('button', { name: 'Suggest Next Email options' }).click();
  const deep = page.getByText('Deep Research', { exact: true });
  await expect(deep).toBeVisible();
  await expect(page.getByText('Slower, more thorough analysis')).toBeVisible();
  await deep.click();
  // Deep Research first asks for optional instructions
  const dialog = page.getByRole('dialog', { name: 'Deep Research — Suggest Next Email' });
  await expect(dialog).toBeVisible();
  const instructions = dialog.getByRole('textbox', { name: 'Instructions (optional)' });
  const note = 'Keep it short and ask for a 15 minute call next week.';
  await instructions.fill(note);
  await expect(dialog.getByText(/^\d+ \/ 4,000$/), 'Character counter').toHaveText(`${note.length} / 4,000`);
  const run = dialog.getByRole('button', { name: 'Run Deep Research' });

  // The new deal has a gmail address and no website, which Deep Research can't research:
  // the message should say so (the API does: SUGGEST_V2_DEEP_RESEARCH_COMPANY_IDENTITY_MISSING)
  const [rejected] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/api/ai/suggest') && r.request().method() === 'POST', { timeout: 240000 }),
    run.click(),
  ]);
  expect(rejected.status(), 'Deep Research without a website or work email').toBe(422);
  const alert = page.getByRole('alert').filter({ hasText: /request|research|website|domain/i }).first();
  await expect(alert).toBeVisible();
  console.log(`[deep] message without website: "${await alert.innerText()}"`);
  await page.screenshot({ path: 'screenshots/SuggestNextEmail-deep-no-website.png' });
  await expect.soft(alert, 'Error should tell the user to add a website or work email').toContainText(/website|domain/i);
  // The message must be readable while the Deep Research dialog is still open
  const alertOnTop = await alert.evaluate(el => {
    const r = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
  });
  expect.soft(alertOnTop, 'Error message should not be hidden behind the Deep Research dialog').toBe(true);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();

  // Add the organization's website, then Deep Research should work
  await editField(page, { section: 'Organization', label: 'Website', value: 'pipeclose.com' });
  await main.getByRole('button', { name: 'Suggest Next Email options' }).click();
  await deep.click();
  await expect(dialog).toBeVisible();
  await instructions.fill(note);
  await checkSuggestion(page, person, 'deep_research', () => run.click());
});
