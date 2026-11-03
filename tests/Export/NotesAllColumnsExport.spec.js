const { test } = require('@playwright/test');
const { exportAllColumns } = require('../common/exportData');

// Export > Notes, date range Any, content as plain text, every column: one test per format.
// Each checks the success message, the downloaded file and the Export History (see tests/common/exportData.js).
test('Export - all notes with all columns as CSV', async ({ page }) => {
  await exportAllColumns(page, 'Notes', 'CSV');
});

test('Export - all notes with all columns as Excel', async ({ page }) => {
  await exportAllColumns(page, 'Notes', 'Excel');
});
