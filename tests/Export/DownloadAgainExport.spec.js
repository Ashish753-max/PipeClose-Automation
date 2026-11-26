// Export > Export History > Download again: download an export a second time from the history
//   1. Make a Deals export (all records, all columns) and download it from the success message
//   2. Export History lists it, and its button now reads "Download again"
//   3. Download again gives the same file: same name, same content, as many records as the history shows
// One test per format. The export is deleted after the test (also when it fails), so runs do not fill up the history.
// Screenshots: screenshots/Export/DownloadAgain-<format>-*.png
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { openExport, readRows } = require('../common/exportData');

const BASE_URL = 'https://staging.pipeclose.com';
const FORMATS = { CSV: 'csv', Excel: 'xlsx' };

// The export made by the test, deleted afterwards
let testExport;
test.afterEach(async ({ page }) => {
  if (!testExport) return;
  const response = await page.request.delete(`${BASE_URL}/api/exports/${testExport.id}`).catch(e => e);
  if (response.ok?.()) console.log(`Cleanup: deleted export #${testExport.id}`);
  else console.warn(`Cleanup: could not delete export #${testExport.id}: ${response.status?.() ?? response.message}`);
  testExport = undefined;
});

for (const format of Object.keys(FORMATS)) {
  test(`Export - Download again from Export History (${format})`, async ({ page }) => {
    test.setTimeout(180000);
    const shot = step => page.screenshot({ path: `screenshots/Export/DownloadAgain-${format}-${step}.png` });
    const extension = FORMATS[format];
    await openExport(page);
    const main = page.getByRole('main');

    let fileName, firstFile;
    await test.step('Make a Deals export and download it', async () => {
      await main.getByRole('button', { name: 'Deals', exact: true }).click();
      const formatButton = main.getByRole('button', { name: format, exact: true });
      await formatButton.click();
      await expect(formatButton).toHaveClass(/--active/);
      await main.getByRole('button', { name: 'Select All', exact: true }).click();
      const [created] = await Promise.all([
        page.waitForResponse(r => r.url().endsWith('/api/exports') && r.request().method() === 'POST', { timeout: 30000 }),
        main.getByRole('button', { name: 'Export', exact: true }).click(),
      ]);
      expect(created.status(), `Export API returned ${created.status()}`).toBe(201);
      testExport = (await created.json()).data;
      fileName = `deals_export_${testExport.id}.${extension}`;

      const success = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: `${extension.toUpperCase()} Export` }) });
      await expect(success, 'The export should finish').toBeVisible({ timeout: 60000 });
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 30000 }),
        success.getByRole('button', { name: 'Download' }).click(),
      ]);
      expect(download.suggestedFilename()).toBe(fileName);
      firstFile = test.info().outputPath(`first-${fileName}`);
      await download.saveAs(firstFile);
      await expect(success).toBeHidden();
      console.log(`Made and downloaded ${fileName}`);
    });

    const row = main.getByRole('row').filter({ hasText: fileName });
    const cells = row.getByRole('cell'); // File Name, Date, Status, Records, Format, Available Until, Actions
    const downloadAgain = row.getByRole('button', { name: /Download again/ });

    await test.step('Export History lists it with "Download again"', async () => {
      await main.getByRole('combobox').selectOption({ label: 'Deals' });
      await expect(row, `${fileName} should be in the Export History`).toHaveCount(1);
      await expect(cells.nth(2)).toHaveText('Ready');
      await expect(cells.nth(4)).toHaveText(extension.toUpperCase());
      await expect(downloadAgain, 'A downloaded export should offer "Download again"').toBeVisible();
      await expect(downloadAgain).toBeEnabled();
      await row.scrollIntoViewIfNeeded();
      await shot('1-history');
    });

    await test.step('Download again gives the same file', async () => {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 30000 }),
        downloadAgain.click(),
      ]);
      expect(download.suggestedFilename(), 'Download again should keep the file name').toBe(fileName);
      const secondFile = test.info().outputPath(`again-${fileName}`);
      await download.saveAs(secondFile);
      await expect(page.getByText('Download Complete', { exact: true }), 'A message should confirm the download').toBeVisible();
      await expect(page.getByText(`${fileName} has been downloaded.`)).toBeVisible();

      // Same file as the first download, with every record the history counts
      const first = fs.readFileSync(firstFile);
      const second = fs.readFileSync(secondFile);
      expect(second.length, 'The file should not be empty').toBeGreaterThan(0);
      expect(second.equals(first), 'Download again should give exactly the same file as the first download').toBe(true);
      const [header, ...records] = readRows(secondFile);
      expect(header.length, 'The file should have its columns').toBeGreaterThan(0);
      await expect(cells.nth(3), 'Records in the history should match the file').toHaveText(String(records.length));
      console.log(`Downloaded ${fileName} again: same ${second.length} bytes, ${header.length} columns, ${records.length} records`);

      // The export stays in the history, still ready to download
      await expect(row).toHaveCount(1);
      await expect(downloadAgain).toBeEnabled();
      await shot('2-downloaded-again');
    });
  });
}
