const { test } = require('@playwright/test');
const { createDeal } = require('../common/createDeal');

test("Deal Creation - Dev", async ({ page }) => {
  await createDeal(page, {
    person: 'Dev',
    organization: 'Microsoft AI',
    value: '4000',
    phone: '367347474721',
    email: 'dev.appnox@gmail.com',
    screenshot: 'CreateDeal4-end.png',
  });
});
