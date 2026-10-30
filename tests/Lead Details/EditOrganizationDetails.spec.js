const { test } = require('@playwright/test');
const { editField, expectSavedAfterReload } = require('../common/dealDetails');
const { openNewLead } = require('../common/leadDetails');

test("Lead details - edit organization details", async ({ page }) => {
  test.setTimeout(240000);
  await openNewLead(page);

  const fields = [
    { section: 'Organization', label: 'Location', value: 'India' },
    { section: 'Organization', label: 'Website', value: 'pipeclose.com' },
    { section: 'Organization', label: 'LinkedIn profile', value: 'linkedin.com/company/pipeclose' },
    { section: 'Organization', label: 'Industry', value: 'Software & Internet', option: true },
    { section: 'Organization', label: 'Annual revenue', value: '1 - 10M USD', option: true },
    { section: 'Organization', label: 'Number of employees', value: '150' },
    { section: 'Organization', label: 'Company size', value: '51-200', option: true },
  ];
  for (const field of fields) await editField(page, field);

  await expectSavedAfterReload(page, fields);
  await page.screenshot({ path: 'screenshots/LeadDetails-EditOrganizationDetails.png' });
});
