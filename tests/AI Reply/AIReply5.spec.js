const { test } = require('@playwright/test');
const aiReply = require('../common/aiReply');

test("AI Reply for email #5 in Inbox", async ({ page }) => {
  test.setTimeout(240000);
  await aiReply(page, 4, 'AIReply5.png');
});
