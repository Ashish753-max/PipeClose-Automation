const { test } = require('@playwright/test');
const aiReply = require('../common/aiReply');

test("AI Reply for email #1 in Inbox", async ({ page }) => {
  test.setTimeout(240000);
  await aiReply(page, 0, 'AIReply1.png');
});
