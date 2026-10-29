const { test } = require('@playwright/test');
const { openNewDeal, editField, expectRejected } = require('../common/dealDetails');

test("Deal details - validation: invalid phone number is refused", async ({ page }) => {
  test.setTimeout(240000);
  await openNewDeal(page);

  const valid = { section: 'Person', label: 'Phone', value: '9876543210', shown: '+19876543210' };
  await editField(page, valid);

  // Too short, letters only, too long
  for (const invalid of ['12', 'abcdefghij', '12345678901234567890']) {
    await expectRejected(page, valid, invalid);
  }
});
