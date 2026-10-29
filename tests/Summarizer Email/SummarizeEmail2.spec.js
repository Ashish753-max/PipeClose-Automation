const { test } = require('@playwright/test');
const summarizeEmail = require('../common/summarizeEmail');

test("Summarize email #2 in Inbox", async ({ page }) => {
  test.setTimeout(240000);
  await summarizeEmail(page, 1, 'SummarizeEmail2.png');
});
