const { test } = require('@playwright/test');
const { exportAllColumns } = require('../common/exportData');

// Export > Leads, scope All (archived or not), every column: one test per format.
// Each checks the success message, the downloaded file and the Export History (see tests/common/exportData.js).
test('Export - all leads with all columns as CSV', async ({ page }) => {
  await exportAllColumns(page, 'Leads', 'CSV');
});

test('Export - all leads with all columns as Excel', async ({ page }) => {
  await exportAllColumns(page, 'Leads', 'Excel');
});
