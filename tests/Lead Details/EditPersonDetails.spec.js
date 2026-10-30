const { test } = require('@playwright/test');
const { editField, expectSavedAfterReload } = require('../common/dealDetails');
const { openNewLead } = require('../common/leadDetails');

test("Lead details - edit person job title, seniority, LinkedIn and requirements", async ({ page }) => {
  test.setTimeout(180000);
  await openNewLead(page);

  const fields = [
    { section: 'Person', label: 'Job Title', value: 'QA Lead' },
    { section: 'Person', label: 'Seniority', value: 'Manager', option: true },
    { section: 'Person', label: 'LinkedIn profile', value: 'linkedin.com/in/rahulverma' },
    { section: 'Person', label: 'Requirements', value: 'Needs CRM automation for the sales team' },
  ];
  for (const field of fields) await editField(page, field);

  await expectSavedAfterReload(page, fields);
  await page.screenshot({ path: 'screenshots/LeadDetails-EditPersonDetails.png' });
});
