const { test } = require('@playwright/test');
const { createDeal } = require('../common/createDeal');

test("Deal Creation - Vijay", async ({ page }) => {
  await createDeal(page, {
    person: 'Vijay',
    organization: 'Pipeclose Tech',
    value: '4000',
    phone: '9878473848',
    email: 'vijay.appnox@gmail.com',
    screenshot: 'CreateDeal3-end.png',
  });
});
