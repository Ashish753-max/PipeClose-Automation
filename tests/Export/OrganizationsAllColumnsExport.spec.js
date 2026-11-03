const { test } = require('@playwright/test');
const { exportAllColumns } = require('../common/exportData');

// Export > Organizations, scope All records, every column: one test per format.
// Each checks the success message, the downloaded file and the Export History (see tests/common/exportData.js).
test('Export - all organizations with all columns as CSV', async ({ page }) => {
  await exportAllColumns(page, 'Organizations', 'CSV');
});

test('Export - all organizations with all columns as Excel', async ({ page }) => {
  await exportAllColumns(page, 'Organizations', 'Excel');
});
