const { test, expect } = require('@playwright/test');
const { fieldRow } = require('../common/dealDetails');
const { openNewLead } = require('../common/leadDetails');

test("Lead details - UX: Enter saves, Escape cancels, typed text is not lost", async ({ page }) => {
  test.setTimeout(240000);
  await openNewLead(page);

  const updates = [];
  page.on('request', r => {
    if (/\/api\/(persons|organisations|leads)\//.test(r.url()) && !r.url().includes('/ai/') && ['PATCH', 'PUT'].includes(r.method())) updates.push(r.url());
  });

  const jobTitle = fieldRow(page, 'Person', 'Job Title');
  const input = jobTitle.locator('input');
  const save = jobTitle.getByRole('button', { name: 'Save', exact: true });
  const cancel = jobTitle.getByRole('button', { name: 'Cancel', exact: true });
  const openJobTitle = async () => {
    await jobTitle.hover();
    await jobTitle.getByRole('button', { name: 'Edit Job Title' }).click();
    await expect(save).toBeVisible();
  };

  // Enter saves
  await openJobTitle();
  await input.fill('QA Lead');
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/persons/') && r.request().method() === 'PUT'),
    input.press('Enter'),
  ]);
  await expect.soft(save, 'Enter should save and close the editor').toBeHidden();
  await expect(jobTitle).toContainText('QA Lead');

  // Escape cancels
  updates.length = 0;
  await openJobTitle();
  await input.fill('Escape pressed');
  await input.press('Escape');
  await page.waitForTimeout(1000);
  await expect.soft(save, 'Escape should close the editor').toBeHidden();
  expect.soft(updates, 'Escape should not save').toEqual([]);
  if (await cancel.isVisible()) await cancel.click();
  await expect(jobTitle).toContainText('QA Lead');

  // Opening another field must not silently throw away what was typed
  await openJobTitle();
  await input.fill('Unsaved text');
  const lastName = fieldRow(page, 'Person', 'Last name');
  await lastName.hover();
  await lastName.getByRole('button', { name: 'Edit Last name' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/LeadDetails-UXEditorKeys.png' });
  await expect.soft(input, 'Job Title editor with unsaved text should stay open when another field is opened')
    .toHaveValue('Unsaved text', { timeout: 1000 });
  for (const button of await page.getByRole('button', { name: 'Cancel', exact: true }).all()) await button.click();
});
