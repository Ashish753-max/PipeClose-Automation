const { test } = require('@playwright/test');
const globalSearch = require('../common/globalSearch');

test("Global search - Organization \"Microsoft Ai\"", async ({ page }) => {
  await globalSearch(page, 'Microsoft Ai', 'Organization', 'SearchOrganization2.png');
});
