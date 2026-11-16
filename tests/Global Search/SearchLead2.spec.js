const { test } = require('@playwright/test');
const globalSearch = require('../common/globalSearch');

test("Global search - Lead \"aman - Tower Research\"", async ({ page }) => {
  await globalSearch(page, 'aman - Tower Research', 'Lead', 'GlobalSearch/SearchLead2.png');
});
