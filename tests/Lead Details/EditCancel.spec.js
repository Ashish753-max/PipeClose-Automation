const { test, expect } = require('@playwright/test');
const { fieldRow } = require('../common/dealDetails');
const { openNewLead } = require('../common/leadDetails');

test("Lead details - Cancel discards the edit", async ({ page }) => {
  test.setTimeout(180000);
  const { person } = await openNewLead(page);

  // Any update request sent after clicking Cancel would be a bug (the page POSTs /ai/analyze on its own)
  const updates = [];
  page.on('request', r => {
    if (r.url().includes('/api/') && !r.url().includes('/ai/') && ['PATCH', 'PUT', 'POST'].includes(r.method())) updates.push(`${r.method()} ${r.url()}`);
  });

  const row = fieldRow(page, 'Person', 'First name');
  await expect(row).toContainText(person);

  // Hover, edit, type a new value, then Cancel
  await row.hover();
  await row.getByRole('button', { name: 'Edit First name' }).click();
  const input = row.locator('input').first();
  await expect(input).toHaveValue(person);
  await input.fill('ShouldNotSave');
  await row.getByRole('button', { name: 'Cancel', exact: true }).click();

  // Editor closes and the old value is still shown
  await expect(row.getByRole('button', { name: 'Save', exact: true })).toBeHidden();
  await expect(row).toContainText(person);
  await expect(row).not.toContainText('ShouldNotSave');
  expect(updates, 'Cancel should not send an update').toEqual([]);

  // Still the old value after reload
  await page.reload();
  await expect(fieldRow(page, 'Person', 'First name')).toContainText(person, { timeout: 30000 });
  await page.screenshot({ path: 'screenshots/LeadDetails-EditCancel.png' });
});
