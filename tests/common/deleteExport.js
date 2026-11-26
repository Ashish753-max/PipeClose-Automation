// tests/common/deleteExport.js
// Shared flow for the Export delete scripts (tests/Export/Delete*.spec.js): delete an export from the Export History.
// Exports are kept for 7 days, so there is often none of the object type. Then one is made first (Export, then
// Download in the success message) and that one is deleted. Only the newest export of the object type is deleted.
// Screenshots: screenshots/Export/Delete<Object>-*.png
const { expect } = require('@playwright/test');
const { openExport } = require('./exportData');

// Object type button and history entry -> name the export API uses for it
const TYPES = { People: 'contacts', Organizations: 'organizations', Activities: 'activities', Notes: 'notes' };

const isExportList = response => /\/api\/exports\?/.test(response.url()) && response.request().method() === 'GET';

/**
 * Makes an export of every record of the object type and downloads it (setup for the delete test).
 * @returns {Promise<object>} the export as the API returns it
 */
async function makeExport(page, object) {
  const main = page.getByRole('main');
  const objectButton = main.getByRole('button', { name: object, exact: true });
  await objectButton.click();
  await expect(objectButton).toHaveClass(/--active/);
  await main.getByRole('button', { name: 'Select All', exact: true }).click();
  const [created] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/api/exports') && r.request().method() === 'POST', { timeout: 30000 }),
    main.getByRole('button', { name: 'Export', exact: true }).click(),
  ]);
  expect(created.status(), `Export API returned ${created.status()}`).toBe(201);
  const job = (await created.json()).data;

  // Download it from the success message once the file is ready
  const success = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: /Export$/ }) });
  await expect(success, 'The export should finish').toBeVisible({ timeout: 60000 });
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    success.getByRole('button', { name: 'Download' }).click(),
  ]);
  await expect(success).toBeHidden();
  console.log(`No ${object} export to delete: made export #${job.id} and downloaded ${download.suggestedFilename()}`);
  return job;
}

/**
 * Deletes the newest export of the object type from the Export History, making one first when there is none.
 * Checks the question before deleting, that Cancel keeps the export, and that Delete removes it for good.
 * @param {import('@playwright/test').Page} page
 * @param {'People'|'Organizations'|'Activities'|'Notes'} object
 */
async function deleteExport(page, object) {
  const shot = step => page.screenshot({ path: `screenshots/Export/Delete${object}-${step}.png` });
  const type = TYPES[object];
  const prefix = object.toLowerCase(); // file names: people_export_12.csv, notes_export_13.xlsx, ...

  // Export page, with the history of the object type
  const [list] = await Promise.all([page.waitForResponse(isExportList, { timeout: 60000 }), openExport(page)]);
  const main = page.getByRole('main');
  const rows = main.getByRole('row').filter({ has: page.getByRole('cell') });
  let job = (await list.json()).data.jobs.find(j => j.objectType === type && j.status === 'ready');
  if (!job) job = await makeExport(page, object);
  else console.log(`Deleting the newest ${object} export, #${job.id}`);
  const fileName = `${prefix}_export_${job.id}.${job.format}`;
  await main.getByRole('combobox').selectOption({ label: object });
  const row = rows.filter({ hasText: fileName });
  await expect(row, `${fileName} should be in the Export History`).toHaveCount(1);
  // The other exports listed, which must all stay (other tests may add exports meanwhile, so no exact count)
  const others = (await rows.locator('td:first-child').allInnerTexts()).map(t => t.trim()).filter(name => name !== fileName);
  await row.scrollIntoViewIfNeeded();
  await shot('1-history');

  // Every DELETE request made from here on (Cancel must not make one)
  const deletes = [];
  page.on('request', request => { if (request.method() === 'DELETE') deletes.push(request.url()); });

  // Delete asks first
  const question = page.getByRole('heading', { name: 'Delete Export', level: 2 }).locator('xpath=..');
  const deleteButton = row.getByRole('button', { name: 'Delete this export' });
  await deleteButton.click();
  await expect(question.getByRole('heading', { name: 'Delete Export' })).toBeVisible();
  await expect(page.getByText('Are you sure you want to delete this export? This cannot be undone.')).toBeVisible();
  const cancel = page.getByRole('button', { name: 'Cancel', exact: true });
  const confirm = page.getByRole('button', { name: 'Delete', exact: true });
  await expect(cancel).toBeVisible();
  await expect(confirm).toBeVisible();
  await shot('2-question');

  // Cancel keeps the export
  await cancel.click();
  await expect(page.getByRole('heading', { name: 'Delete Export' }), 'The question should close').toBeHidden();
  await expect(row, 'Cancel should keep the export').toHaveCount(1);
  expect(deletes, 'Cancel should not delete anything').toEqual([]);

  // Delete removes it
  await deleteButton.click();
  await expect(page.getByRole('heading', { name: 'Delete Export' })).toBeVisible();
  const [deleted] = await Promise.all([
    page.waitForResponse(r => r.request().method() === 'DELETE' && r.url().includes('/api/exports/'), { timeout: 30000 }),
    confirm.click(),
  ]);
  expect(deleted.ok(), `Delete API returned ${deleted.status()}`).toBeTruthy();
  expect(new URL(deleted.url()).pathname, `Export #${job.id} should be the one deleted`).toMatch(new RegExp(`/api/exports/${job.id}$`));
  expect(deletes, 'Only this export should be deleted').toHaveLength(1);
  await expect(page.getByRole('heading', { name: 'Delete Export' }), 'The question should close').toBeHidden();
  await expect(page.getByText('Export Deleted', { exact: true }), 'A message should confirm the delete').toBeVisible();
  await expect(page.getByText('The export job has been successfully deleted.')).toBeVisible();
  await expect(row, `${fileName} should leave the Export History`).toHaveCount(0);
  for (const name of others) {
    await expect(rows.filter({ hasText: name }), `Only this export should leave the history, not ${name}`).toHaveCount(1);
  }
  if (others.length === 0 && await rows.count() === 0) {
    await expect(main.getByText(`No ${object} exports yet`), 'An empty history should say so').toBeVisible();
  }
  console.log(`Deleted ${fileName}`);
  await shot('3-deleted');

  // Still gone after reloading the page
  const [reloaded] = await Promise.all([page.waitForResponse(isExportList, { timeout: 30000 }), page.reload()]);
  expect((await reloaded.json()).data.jobs.map(j => j.id), `Export #${job.id} should be gone for good`).not.toContain(job.id);
  await expect(page.getByRole('heading', { name: 'Export Data', level: 1 })).toBeVisible({ timeout: 30000 });
  await main.getByRole('combobox').selectOption({ label: object });
  await expect(row, `${fileName} should still be gone after a reload`).toHaveCount(0);
}

module.exports = { deleteExport };
