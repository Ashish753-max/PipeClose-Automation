const { test } = require('@playwright/test');
const aiReply = require('../common/aiReply');

test("AI Reply for email #2 in Inbox", async ({ page }) => {
  test.setTimeout(240000);
  await aiReply(page, 1, 'AIReply2.png');
});
