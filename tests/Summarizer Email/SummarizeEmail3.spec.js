const { test } = require('@playwright/test');
const summarizeEmail = require('../common/summarizeEmail');

test("Summarize email #3 in Inbox", async ({ page }) => {
  test.setTimeout(240000);
  await summarizeEmail(page, 2, 'SummarizeEmail3.png');
});
