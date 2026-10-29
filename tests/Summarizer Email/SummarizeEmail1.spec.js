const { test } = require('@playwright/test');
const summarizeEmail = require('../common/summarizeEmail');

test("Summarize email #1 in Inbox", async ({ page }) => {
  test.setTimeout(240000);
  await summarizeEmail(page, 0, 'SummarizeEmail1.png');
});
