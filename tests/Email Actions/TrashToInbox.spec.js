const { test } = require('@playwright/test');
const { moveBackToInbox } = require('../common/emailFolders');

// Mail > Trash: a deleted email is restored to the Inbox with its hover "Move to inbox" button
// (see tests/common/emailFolders.js). Screenshots: screenshots/EmailActions/TrashToInbox-*.png
test('Restore a deleted email from Trash to the Inbox', async ({ page }) => {
  test.setTimeout(240000);
  await moveBackToInbox(page, 'Trash', 'TrashToInbox');
});
