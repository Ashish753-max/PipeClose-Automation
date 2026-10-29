const { test } = require('@playwright/test');
const { openNewDeal, editField, expectRejected } = require('../common/dealDetails');

test("Deal details - validation: LinkedIn profile must be a LinkedIn URL", async ({ page }) => {
  test.setTimeout(240000);
  await openNewDeal(page);

  // Errors the Person field already shows; the Organization field should behave the same
  const invalid = [
    ['hello world', 'LinkedIn URL cannot contain spaces'],
    ['https://google.com', 'Must be a linkedin.com URL'],
  ];
  const fields = [
    { section: 'Person', label: 'LinkedIn profile', value: 'linkedin.com/in/rahulverma' },
    { section: 'Organization', label: 'LinkedIn profile', value: 'linkedin.com/company/pipeclose' },
  ];
  for (const valid of fields) {
    await editField(page, valid);
    for (const [value, message] of invalid) await expectRejected(page, valid, value, message);
  }
});
