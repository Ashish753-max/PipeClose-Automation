const { test } = require('@playwright/test');
const { openNewDeal, editField, expectRejected } = require('../common/dealDetails');

test("Deal details - validation: number of employees must be a whole positive number", async ({ page }) => {
  test.setTimeout(240000);
  await openNewDeal(page);

  const valid = { section: 'Organization', label: 'Number of employees', value: '150' };
  await editField(page, valid);

  for (const invalid of ['abc', '-5', '1.5']) await expectRejected(page, valid, invalid);
});
