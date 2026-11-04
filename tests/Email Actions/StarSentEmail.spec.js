const { test } = require('@playwright/test');
const { starEmail } = require('../common/starEmail');

// Mail > Sent: star the newest email, check it in the Starred view with the star marked, then unstar it
// (see tests/common/starEmail.js). Screenshots: screenshots/StarEmail/Sent-*.png
test('Star a Sent email and check it in Starred', async ({ page }) => {
  test.setTimeout(180000);
  await starEmail(page, 'Sent');
});
