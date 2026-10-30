const { test } = require('@playwright/test');
const { editField, expectRejected } = require('../common/dealDetails');
const { openNewLead } = require('../common/leadDetails');

test("Lead details - validation: number of employees must be a whole positive number", async ({ page }) => {
  test.setTimeout(240000);
  await openNewLead(page);

  const valid = { section: 'Organization', label: 'Number of employees', value: '150' };
  await editField(page, valid);

  for (const invalid of ['abc', '-5', '1.5']) await expectRejected(page, valid, invalid);
});
