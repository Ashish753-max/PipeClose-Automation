const { test } = require('@playwright/test');
const { exportAllColumns } = require('../common/exportData');

// Export > Activities, scope All records, every column: one test per format.
// Each checks the success message, the downloaded file and the Export History (see tests/common/exportData.js).
test('Export - all activities with all columns as CSV', async ({ page }) => {
  await exportAllColumns(page, 'Activities', 'CSV');
});

test('Export - all activities with all columns as Excel', async ({ page }) => {
  await exportAllColumns(page, 'Activities', 'Excel');
});
