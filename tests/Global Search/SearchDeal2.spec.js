const { test } = require('@playwright/test');
const globalSearch = require('../common/globalSearch');

test("Global search - Deal \"Vijay - Pipeclose Tech Deal\"", async ({ page }) => {
  await globalSearch(page, 'Vijay - Pipeclose Tech Deal', 'Deal', 'SearchDeal2.png');
});
