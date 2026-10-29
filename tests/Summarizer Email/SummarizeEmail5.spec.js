const { test } = require('@playwright/test');
const summarizeEmail = require('../common/summarizeEmail');

test("Summarize email #5 in Inbox", async ({ page }) => {
  test.setTimeout(240000);
  await summarizeEmail(page, 4, 'SummarizeEmail5.png');
});
