const { test, expect } = require('@playwright/test');
const { openNewLead, expectValueRejected, tryValue, editValue, amount } = require('../common/leadDetails');

test("Lead details - validation: lead value must be a positive amount", async ({ page }) => {
  test.setTimeout(240000);
  await openNewLead(page);

  // Created with a value of 2500
  const valid = { value: '2500', shown: '$2,500' };
  await expect(amount(page)).toHaveText(valid.shown);

  // Letters and negative amounts must not change the saved amount
  for (const invalid of ['abc', '-500']) await expectValueRejected(page, valid, invalid);

  // A decimal may be refused or kept with its cents, but never saved as a different amount
  const { stored } = await tryValue(page, '1.5');
  console.log(`Summary > Value "1.5": stored as "${stored}"`);
  expect.soft([valid.shown, '$1.5', '$1.50'], `Value "1.5" was saved as "${stored}"`).toContain(stored);
  if (stored !== valid.shown) await editValue(page, valid);
});
