const { test } = require('@playwright/test');
const { createDeal } = require('../common/createDeal');

test("Deal Creation - Kunal", async ({ page }) => {
  await createDeal(page, {
    person: 'Kunal',
    organization: 'Google India',
    value: '4000',
    phone: '34738284738',
    email: 'kunal.appnox@gmail.com',
    screenshot: 'CreateDeal5-end.png',
  });
});
