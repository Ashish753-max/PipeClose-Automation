const { test } = require('@playwright/test');
const globalSearch = require('../common/globalSearch');

test("Global search - Lead \"Vijay - Travelmatic\"", async ({ page }) => {
  await globalSearch(page, 'Vijay - Travelmatic', 'Lead', 'GlobalSearch/SearchLead1.png');
});
