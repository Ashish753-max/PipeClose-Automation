const { test } = require('@playwright/test');
const { openNewDeal, editField, expectSavedAfterReload } = require('../common/dealDetails');

test("Deal details - edit person first and last name", async ({ page }) => {
  test.setTimeout(180000);
  await openNewDeal(page);

  const fields = [
    { section: 'Person', label: 'First name', value: 'Rahul' },
    { section: 'Person', label: 'Last name', value: 'Verma' },
  ];
  for (const field of fields) await editField(page, field);

  await expectSavedAfterReload(page, fields);
  await page.screenshot({ path: 'screenshots/DealDetails-EditPersonName.png' });
});
