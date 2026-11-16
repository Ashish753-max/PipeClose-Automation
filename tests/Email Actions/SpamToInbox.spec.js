const { test } = require('@playwright/test');
const { moveBackToInbox } = require('../common/emailFolders');

// Mail > Spam: an email in Spam is moved back to the Inbox with its hover "Not spam" button
// (see tests/common/emailFolders.js). Screenshots: screenshots/EmailActions/SpamToInbox-*.png
test('Move a spam email back to the Inbox with Not spam', async ({ page }) => {
  test.setTimeout(240000);
  await moveBackToInbox(page, 'Spam', 'SpamToInbox');
});
