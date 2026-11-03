const { test } = require('@playwright/test');
const { exportAllColumns } = require('../common/exportData');

// Export > Deals, scope All (archived or not), every column: one test per format.
// Each checks the success message, the downloaded file and the Export History (see tests/common/exportData.js).
test('Export - all deals with all columns as CSV', async ({ page }) => {
  await exportAllColumns(page, 'Deals', 'CSV');
});

test('Export - all deals with all columns as Excel', async ({ page }) => {
  await exportAllColumns(page, 'Deals', 'Excel');
});
