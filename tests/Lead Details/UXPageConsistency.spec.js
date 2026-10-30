const { test, expect } = require('@playwright/test');
const { editField } = require('../common/dealDetails');
const { openNewLead, summaryBlock, tryValue, reloadLead } = require('../common/leadDetails');

test("Lead details - UX: heading and Summary stay in line with the edits", async ({ page }) => {
  test.setTimeout(240000);
  const { organization } = await openNewLead(page);
  // Lead title (the page has a second h1, "Close deals faster with better email.")
  const heading = page.getByRole('heading', { level: 1 }).first();

  await editField(page, { section: 'Person', label: 'First name', value: 'Rahul' });
  await editField(page, { section: 'Person', label: 'Last name', value: 'Verma' });

  // Summary and heading follow the new name straight away
  await expect.soft(summaryBlock(page), 'Summary should show the new person name').toContainText('Rahul Verma');
  await expect.soft(heading, 'Heading should show the new person name').toContainText('Rahul');

  // The organization keeps the spelling it was created with, e.g. "LeadOrg123456" (not "Leadorg123456")
  await reloadLead(page);
  console.log(`Heading after editing the name: "${await heading.innerText()}"`);
  await expect.soft(summaryBlock(page), 'Summary should keep the organization name as written').toContainText(organization);
  await expect.soft(heading, `Heading should keep the organization name "${organization}" as written`).toContainText(organization);

  // A USD amount should use US digit grouping: $1,234,567 (not $12,34,567)
  const { stored } = await tryValue(page, '1234567');
  console.log(`Value 1234567 shown as "${stored}"`);
  expect.soft(stored, 'Value 1234567 in USD should be shown as $1,234,567').toBe('$1,234,567');
  await page.screenshot({ path: 'screenshots/LeadDetails-UXPageConsistency.png' });
});
