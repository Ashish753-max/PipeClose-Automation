const { test } = require('@playwright/test');
const { editField, expectSavedAfterReload } = require('../common/dealDetails');
const { openNewLead } = require('../common/leadDetails');

test("Lead details - edit person email", async ({ page }) => {
  test.setTimeout(180000);
  await openNewLead(page);

  // Unique per run: the app rejects an email already used by a deal
  const fields = [
    { section: 'Person', label: 'Email', value: `rahul.verma+${Date.now()}@gmail.com` },
  ];
  for (const field of fields) await editField(page, field);

  await expectSavedAfterReload(page, fields);
  await page.screenshot({ path: 'screenshots/LeadDetails-EditPersonEmail.png' });
});
