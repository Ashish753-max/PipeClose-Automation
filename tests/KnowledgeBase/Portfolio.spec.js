// AI Knowledge Base > Portfolio
//   1. Open the section
//   2. It shows the portfolio project form (name, description, link); Save is disabled
// Nothing is saved. Screenshot: screenshots/KnowledgeBase/Portfolio-1-opened.png
const { test, expect } = require('@playwright/test');
const { openKnowledgeBase, openSection } = require('../common/knowledgeBase');

test('AI Knowledge Base - Portfolio', async ({ page }) => {
  const main = page.getByRole('main');

  // Step 1: Open the section
  await openKnowledgeBase(page);
  await openSection(page, 'Portfolio');

  // Step 2: Check what it shows
  await expect(main.getByRole('heading', { name: 'Portfolio Project', level: 4 })).toBeVisible();
  await expect(main.getByPlaceholder('e.g., Customer Portal Implementation')).toBeVisible();
  await expect(main.getByPlaceholder(/^e\.g\., Implemented a customer self-service portal/)).toBeVisible();
  await expect(main.getByPlaceholder('e.g., https://www.example.com/case-study')).toBeVisible();
  await expect(main.getByRole('button', { name: 'Save Changes', exact: true }), 'Nothing to save yet').toBeDisabled();
  await page.screenshot({ path: 'screenshots/KnowledgeBase/Portfolio-1-opened.png' });
});
