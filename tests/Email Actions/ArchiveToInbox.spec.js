const { test } = require('@playwright/test');
const { moveBackToInbox } = require('../common/emailFolders');

// Mail > Archive: an archived email is moved back to the Inbox with its hover "Move to inbox" button
// (see tests/common/emailFolders.js). Screenshots: screenshots/EmailActions/ArchiveToInbox-*.png
test('Move an archived email back to the Inbox', async ({ page }) => {
  test.setTimeout(240000);
  await moveBackToInbox(page, 'Archive', 'ArchiveToInbox');
});
