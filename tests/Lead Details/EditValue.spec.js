const { test, expect } = require('@playwright/test');
const { openNewLead, editValue, amount, reloadLead } = require('../common/leadDetails');

test("Lead details - edit lead value in the Summary", async ({ page }) => {
  test.setTimeout(180000);
  await openNewLead(page);

  // Created with a value of 2500
  await expect(amount(page)).toHaveText('$2,500');
  await editValue(page, { value: '75000', shown: '$75,000' });

  await reloadLead(page);
  await expect(amount(page), 'Value should stay after reload').toHaveText('$75,000');
  await page.screenshot({ path: 'screenshots/LeadDetails-EditValue.png' });
});
