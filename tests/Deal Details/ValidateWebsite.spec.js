const { test } = require('@playwright/test');
const { openNewDeal, editField, expectRejected } = require('../common/dealDetails');

test("Deal details - validation: invalid website is refused", async ({ page }) => {
  test.setTimeout(240000);
  await openNewDeal(page);

  const valid = { section: 'Organization', label: 'Website', value: 'pipeclose.com' };
  await editField(page, valid);

  for (const invalid of ['not a url', 'pipeclose,com', 'https://']) {
    await expectRejected(page, valid, invalid);
  }
});
