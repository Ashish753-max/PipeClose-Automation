// AI Knowledge Base > Company Profile
//   1. Open the section. If an earlier run saved a profile, clear it first
//      (saving needs a change, and the dropdowns can only be picked while they read "Select ...")
//   2. Fill in the name, industry, description, size and website
//   3. Save: the server saves the profile and the section no longer "Needs attention"
//   4. Reload: the profile is still there
// Screenshots: screenshots/KnowledgeBase/CompanyProfile-*.png
const { test, expect } = require('@playwright/test');
const {
  openKnowledgeBase, reloadKnowledgeBase, openSection, sectionHeader, pickOption, clearSection, saveSection,
} = require('../common/knowledgeBase');

const PROFILE = {
  name: 'Pipeclose',
  industry: 'Technology / SaaS',
  description: 'PipeClose is a CRM (Customer Relationship Management) platform that helps businesses manage their sales '
    + 'pipeline, customer communication, and business relationships from one place. It enables sales teams to capture '
    + 'leads, track deals, manage activities, and collaborate efficiently while reducing manual work through automation.',
  size: '51 – 200 (Growing company)',
  website: 'pipeclose.com',
};

test('AI Knowledge Base - Company Profile', async ({ page }) => {
  const main = page.getByRole('main');
  const nameField = main.getByPlaceholder('e.g., Appnox Technologies');
  const descriptionField = main.getByPlaceholder('e.g., Describe what your company does, who it serves, and the value it provides.');
  const websiteField = main.getByPlaceholder('e.g., https://www.example.com');
  const header = sectionHeader(page, 'Company Profile');

  // Step 1: Open the section, and clear a profile saved by an earlier run
  const knowledgeBase = await openKnowledgeBase(page);
  await openSection(page, 'Company Profile');
  await expect(nameField).toBeVisible();
  if (knowledgeBase.category_1_company_profile.company_name) {
    await clearSection(page, 'Company Profile');
    await expect(nameField, 'The profile should be cleared').toHaveValue('');
    await expect(header, 'A cleared profile needs attention').toContainText('Needs attention');
  }

  // Step 2: Fill in the profile
  await nameField.fill(PROFILE.name);
  await pickOption(page, main.getByRole('button', { name: 'Select industry', exact: true }), PROFILE.industry);
  await descriptionField.fill(PROFILE.description);
  await pickOption(page, main.getByRole('button', { name: 'Select size', exact: true }), PROFILE.size);
  // The website is only taken (and Save enabled) once Enter is pressed; it then gets the https:// prefix
  await websiteField.fill(PROFILE.website);
  await websiteField.press('Enter');
  await expect(websiteField).toHaveValue(`https://${PROFILE.website}`);
  await page.screenshot({ path: 'screenshots/KnowledgeBase/CompanyProfile-1-filled.png' });

  // Step 3: Save
  const saved = await saveSection(page, 'Company Profile');
  expect(saved.category_1_company_profile).toMatchObject({
    company_name: PROFILE.name,
    industry: PROFILE.industry,
    company_size: '51-200',
    description: PROFILE.description,
    website: `https://${PROFILE.website}/`,
  });
  await expect(header, 'The profile should no longer need attention').not.toContainText('Needs attention');
  await page.screenshot({ path: 'screenshots/KnowledgeBase/CompanyProfile-2-saved.png' });

  // Step 4: Reload: the profile is still there
  await reloadKnowledgeBase(page);
  await openSection(page, 'Company Profile');
  await expect(nameField).toHaveValue(PROFILE.name);
  await expect(main.getByRole('button', { name: PROFILE.industry, exact: true })).toBeVisible();
  await expect(descriptionField).toHaveValue(PROFILE.description);
  await expect(main.getByRole('button', { name: PROFILE.size, exact: true })).toBeVisible();
  await expect(websiteField).toHaveValue(`https://${PROFILE.website}/`);
  await expect(header).not.toContainText('Needs attention');
  await page.screenshot({ path: 'screenshots/KnowledgeBase/CompanyProfile-3-after-reload.png' });
});
