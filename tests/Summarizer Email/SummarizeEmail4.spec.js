const { test } = require('@playwright/test');
const summarizeEmail = require('../common/summarizeEmail');

test("Summarize email #4 in Inbox", async ({ page }) => {
  test.setTimeout(240000);
  await summarizeEmail(page, 3, 'SummarizeEmail4.png');
});
