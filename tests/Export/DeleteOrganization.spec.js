const { test } = require('@playwright/test');
const { deleteExport } = require('../common/deleteExport');

// Export > Export History > Organizations: delete the newest Organizations export (one is made and downloaded first
// when there is none). Checks the question, that Cancel keeps it and that Delete removes it (tests/common/deleteExport.js).
test('Export - delete an Organizations export', async ({ page }) => {
  test.setTimeout(180000);
  await deleteExport(page, 'Organizations');
});
