// AI Knowledge Base > Communication Preferences
//   1. Open the section
//   2. It shows the communication style and the preferred / avoided words fields; Save is disabled
// Nothing is saved. Screenshot: screenshots/KnowledgeBase/CommunicationPreference-1-opened.png
const { test, expect } = require('@playwright/test');
const { openKnowledgeBase, openSection } = require('../common/knowledgeBase');

test('AI Knowledge Base - Communication Preferences', async ({ page }) => {
  const main = page.getByRole('main');

  // Step 1: Open the section
  await openKnowledgeBase(page);
  await openSection(page, 'Communication Preferences');

  // Step 2: Check what it shows
  await expect(main.getByText('Communication Style', { exact: true })).toBeVisible();
  await expect(main.getByRole('button', { name: /^(Balanced Default|Casual|Professional)$/ }), 'The current style should show')
    .toBeVisible();
  await expect(main.getByPlaceholder('e.g., helpful, clear, reliable, customer-focused, easy to use')).toBeVisible();
  await expect(main.getByPlaceholder('e.g., cheap, guaranteed, no risk, instantly, perfect')).toBeVisible();
  await expect(main.getByRole('button', { name: 'Save Changes', exact: true }), 'Nothing to save yet').toBeDisabled();
  await page.screenshot({ path: 'screenshots/KnowledgeBase/CommunicationPreference-1-opened.png' });
});
