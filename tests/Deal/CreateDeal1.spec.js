const { test } = require('@playwright/test');
const { createDeal } = require('../common/createDeal');

test("Deal Creation - Ashish Rai", async ({ page }) => {
  await createDeal(page, {
    person: 'Ashish Rai',
    organization: 'Appnox Technologies Pvt. Ltd.',
    value: '4000',
    phone: '9878473848',
    email: 'ashishappnox1@gmail.com',
    screenshot: 'CreateDeal1-end.png',
  });
});
