// AI Knowledge Base > Products & Services
//   1. Open the section and click "Add Product / Service": the form opens with Add disabled
//   2. Type a name: Add is still disabled (it needs a description too)
//   3. Type a description: Add is enabled
// Nothing is added or saved. Screenshots: screenshots/KnowledgeBase/ProductsAndServices-*.png
const { test, expect } = require('@playwright/test');
const { openKnowledgeBase, openSection } = require('../common/knowledgeBase');

test('AI Knowledge Base - Products & Services', async ({ page }) => {
  const main = page.getByRole('main');
  const nameField = main.getByPlaceholder('Product / Service Name *');
  const descriptionField = main.getByPlaceholder(/^Briefly describe what this product or service offers/);
  const addButton = main.getByRole('button', { name: 'Add', exact: true });

  // Step 1: Open the section and the product form
  await openKnowledgeBase(page);
  await openSection(page, 'Products & Services');
  await main.getByRole('button', { name: 'Add Product / Service', exact: true }).click();
  await expect(nameField).toBeVisible();
  await expect(descriptionField).toBeVisible();
  await expect(addButton, 'Add needs a name and a description').toBeDisabled();

  // Step 2: Type a name
  await nameField.fill('Test Product');
  await expect(nameField).toHaveValue('Test Product');
  await expect(addButton, 'Add still needs a description').toBeDisabled();

  // Step 3: Type a description
  await descriptionField.fill('Test product description');
  await expect(addButton, 'Add should be enabled').toBeEnabled();
  await page.screenshot({ path: 'screenshots/KnowledgeBase/ProductsAndServices-1-form-filled.png' });
});
