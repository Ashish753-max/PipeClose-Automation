const { test } = require('@playwright/test');
const globalSearch = require('../common/globalSearch');

test("Global search - Deal \"Dev - Microsoft Ai Deal\"", async ({ page }) => {
  await globalSearch(page, 'Dev - Microsoft Ai Deal', 'Deal', 'SearchDeal1.png');
});
