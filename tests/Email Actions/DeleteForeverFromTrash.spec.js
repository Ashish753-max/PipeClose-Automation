const { test } = require('@playwright/test');
const { deleteForever, emptyTrash } = require('../common/emailFolders');

// Mail > Trash: delete a test email forever, and empty the Trash (see tests/common/emailFolders.js).
// Only test emails are destroyed. When Trash has no test email, one is sent to the mailbox itself and the test waits
// for the mail server to deliver it (minutes on staging), so a test can take up to ~25 minutes.
// Screenshots: screenshots/EmailActions/DeleteForever-*.png and EmptyTrash-*.png

// One after the other: Empty Trash would also delete the other test's email while it is in Trash
test.describe.configure({ mode: 'default' });

test('Delete an email forever from Trash', async ({ page }) => {
  test.setTimeout(30 * 60000);
  await deleteForever(page);
});

// Empty Trash deletes everything in Trash without asking, so this test only empties it when Trash holds nothing
// but test emails; otherwise it is skipped and the emails in Trash are kept
test('Empty Trash', async ({ page }) => {
  test.setTimeout(30 * 60000);
  await emptyTrash(page);
});
