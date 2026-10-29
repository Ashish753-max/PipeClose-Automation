const { test } = require('@playwright/test');
const { openNewDeal, editField, expectRejected } = require('../common/dealDetails');

test("Deal details - validation: person name cannot be emptied", async ({ page }) => {
  test.setTimeout(240000);
  await openNewDeal(page);

  // The person has no last name, so an empty first name would leave them without a name
  const valid = { section: 'Person', label: 'First name', value: 'Rahul' };
  await editField(page, valid);

  for (const invalid of ['', '   ']) await expectRejected(page, valid, invalid);
});
