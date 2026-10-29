const { test } = require('@playwright/test');
const { openNewDeal, editField, expectSavedAfterReload } = require('../common/dealDetails');

test("Deal details - edit person phone number", async ({ page }) => {
  test.setTimeout(180000);
  await openNewDeal(page);

  const fields = [
    { section: 'Person', label: 'Phone', value: '9123456789', shown: '+19123456789' },
  ];
  for (const field of fields) await editField(page, field);

  await expectSavedAfterReload(page, fields);
  await page.screenshot({ path: 'screenshots/DealDetails-EditPersonPhone.png' });
});
