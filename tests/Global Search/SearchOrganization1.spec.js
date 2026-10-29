const { test } = require('@playwright/test');
const globalSearch = require('../common/globalSearch');

test("Global search - Organization \"Appnox Technologies\"", async ({ page }) => {
  await globalSearch(page, 'Appnox Technologies', 'Organization', 'SearchOrganization1.png');
});
