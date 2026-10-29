const { test } = require('@playwright/test');
const { openNewDeal, editField, expectSavedAfterReload } = require('../common/dealDetails');

test("Deal details - edit person email", async ({ page }) => {
  test.setTimeout(180000);
  await openNewDeal(page);

  // Unique per run: the app rejects an email already used by another deal
  const fields = [
    { section: 'Person', label: 'Email', value: `rahul.verma+${Date.now()}@gmail.com` },
  ];
  for (const field of fields) await editField(page, field);

  await expectSavedAfterReload(page, fields);
  await page.screenshot({ path: 'screenshots/DealDetails-EditPersonEmail.png' });
});
