const { test, expect } = require('@playwright/test');
const { openNewLead, summaryBlock, reloadLead, LEAD_UPDATE_URL } = require('../common/leadDetails');

test("Lead details - set expected close date in the Summary", async ({ page }) => {
  test.setTimeout(180000);
  await openNewLead(page);

  // The 15th of next month, e.g. "November 15th, 2026"
  const date = new Date();
  date.setDate(15);
  date.setMonth(date.getMonth() + 1);
  const month = date.toLocaleString('en-US', { month: 'long' });
  const label = `${month} 15th, ${date.getFullYear()}`;
  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-15`;

  // Open the calendar and pick the date
  await page.getByRole('button', { name: 'Add expected close date' }).click();
  const calendar = page.getByRole('dialog');
  await expect(calendar, 'Calendar should open').toBeVisible();
  await calendar.getByRole('button', { name: 'Go to the Next Month' }).click();
  const [response] = await Promise.all([
    page.waitForResponse(r => LEAD_UPDATE_URL.test(r.url()) && r.request().method() === 'PUT'),
    calendar.getByRole('button', { name: new RegExp(`${label}$`) }).click(),
  ]);
  expect(response.ok(), `Close date update API returned ${response.status()}`).toBeTruthy();
  expect(response.request().postData()).toContain(iso);

  // Calendar closes and the Summary shows the date in place of "Add expected close date"
  await expect(calendar, 'Calendar should close after picking a date').toBeHidden();
  await expect(summaryBlock(page).getByRole('button', { name: label, exact: true })).toBeVisible();
  console.log(`Summary > Expected close date saved as "${label}"`);

  await reloadLead(page);
  await expect(summaryBlock(page).getByRole('button', { name: label, exact: true }), 'Close date should stay after reload').toBeVisible();
  await page.screenshot({ path: 'screenshots/LeadDetails-EditCloseDate.png' });
});
