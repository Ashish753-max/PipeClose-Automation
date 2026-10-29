const { test } = require('@playwright/test');
const { createDeal } = require('../common/createDeal');

test("Deal Creation - Shivam", async ({ page }) => {
  await createDeal(page, {
    person: 'Shivam',
    organization: 'Pipeclose',
    value: '4000',
    phone: '9878473848',
    email: 'shivam.appnox@gmail.com',
    screenshot: 'CreateDeal2-end.png',
  });
});
