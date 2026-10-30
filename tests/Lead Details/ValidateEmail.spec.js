const { test } = require('@playwright/test');
const { editField, expectRejected } = require('../common/dealDetails');
const { openNewLead } = require('../common/leadDetails');

test("Lead details - validation: invalid email is refused", async ({ page }) => {
  test.setTimeout(300000);
  await openNewLead(page);

  // Unique per run: the app rejects an email already used by a deal
  const stamp = Date.now();
  const valid = { section: 'Person', label: 'Email', value: `rahul.verma+${stamp}@gmail.com` };
  await editField(page, valid);

  // Unique too, so the duplicate-email rule does not hide the format check
  for (const invalid of [`not-an-email-${stamp}`, `rahul${stamp}@`, `@gmail${stamp}.com`, `rahul verma${stamp}@gmail.com`]) {
    await expectRejected(page, valid, invalid);
  }

  // Already used by the existing deal "Kunal - Google India Deal"; the server refuses it with this message
  await expectRejected(page, valid, 'kunal.appnox@gmail.com', 'already exist');
});
