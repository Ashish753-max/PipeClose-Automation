// AI Knowledge Base > Common Customer Objections
//   1. Open the section
//   2. It shows the suggested objections, the objection and response fields, and the objection count;
//      Add and Save are disabled until something is typed
// Nothing is saved. Screenshot: screenshots/KnowledgeBase/CommonCustomerObjection-1-opened.png
const { test, expect } = require('@playwright/test');
const { openKnowledgeBase, openSection } = require('../common/knowledgeBase');

test('AI Knowledge Base - Common Customer Objections', async ({ page }) => {
  const main = page.getByRole('main');

  // Step 1: Open the section
  await openKnowledgeBase(page);
  await openSection(page, 'Common Customer Objections');

  // Step 2: Check what it shows
  await expect(main.getByRole('button', { name: 'Price is too high', exact: true }), 'Suggested objections should be listed')
    .toBeVisible();
  await expect(main.getByPlaceholder('Describe a common customer objection...')).toBeVisible();
  await expect(main.getByPlaceholder('Write the recommended sales response for this objection...')).toBeVisible();
  await expect(main.getByText(/^\d+ \/ 50 objections$/)).toBeVisible();
  await expect(main.getByRole('button', { name: 'Add Objection & Response', exact: true }), 'Nothing to add yet')
    .toBeDisabled();
  await expect(main.getByRole('button', { name: 'Save Changes', exact: true }), 'Nothing to save yet').toBeDisabled();
  await page.screenshot({ path: 'screenshots/KnowledgeBase/CommonCustomerObjection-1-opened.png' });
});
