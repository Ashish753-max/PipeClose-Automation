const { test } = require('@playwright/test');
const { exportAllColumns } = require('../common/exportData');

// Export > Files, scope All records, date range Any, every column: one test per format.
// Each checks the success message, the downloaded file and the Export History (see tests/common/exportData.js).
test('Export - all files with all columns as CSV', async ({ page }) => {
  await exportAllColumns(page, 'Files', 'CSV');
});

test('Export - all files with all columns as Excel', async ({ page }) => {
  await exportAllColumns(page, 'Files', 'Excel');
});
