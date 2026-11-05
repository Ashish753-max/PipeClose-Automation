// AI Knowledge Base > Sales Playbook
//   1. Open the section. If an earlier run saved questions or talking points, empty them and save first
//      (saving needs a change)
//   2. Fill in the discovery questions and key talking points (one per line) and save
//   3. Reload: they are still there
// The Ideal Customer Profile is left as it is: it is the account's ICP, also used for lead and deal fit scoring.
// Screenshots: screenshots/KnowledgeBase/SalesPlaybook-*.png
const { test, expect } = require('@playwright/test');
const {
  openKnowledgeBase, reloadKnowledgeBase, openSection, sectionHeader, saveSection,
} = require('../common/knowledgeBase');

const QUESTIONS = [
  'What are your current challenges?',
  'What does your ideal solution look like?',
  'What is your timeline for making a decision?',
  'Who else is involved in the buying process?',
  'What would success look like for you in 6 months?',
];
const TALKING_POINTS = [
  'We have helped 100+ companies...',
  'Our average ROI is 3x...',
  'We offer dedicated onboarding and support...',
  'Our solution integrates seamlessly with your existing tools...',
  'Trusted by industry leaders across 20+ countries...',
];

test('AI Knowledge Base - Sales Playbook', async ({ page }) => {
  const main = page.getByRole('main');
  // The placeholders are example lists, so match their first line
  const questionsField = main.getByPlaceholder(/^What are your current challenges\?/);
  const talkingPointsField = main.getByPlaceholder(/^We.ve helped 100\+ companies/);

  // Step 1: Open the section, and empty the lists saved by an earlier run
  const knowledgeBase = await openKnowledgeBase(page);
  await openSection(page, 'Sales Playbook');
  await expect(questionsField).toBeVisible();
  await expect(talkingPointsField).toBeVisible();
  const savedBefore = knowledgeBase.category_3_sales_process;
  if (savedBefore.discovery_questions.length > 0 || savedBefore.key_talking_points.length > 0) {
    await questionsField.fill('');
    await talkingPointsField.fill('');
    const emptied = await saveSection(page, 'Sales Playbook');
    expect(emptied.category_3_sales_process).toMatchObject({ discovery_questions: [], key_talking_points: [] });
  }

  // Step 2: Fill in the questions and talking points, and save
  await questionsField.fill(QUESTIONS.join('\n'));
  await talkingPointsField.fill(TALKING_POINTS.join('\n'));
  await page.screenshot({ path: 'screenshots/KnowledgeBase/SalesPlaybook-1-filled.png' });
  const saved = await saveSection(page, 'Sales Playbook');
  expect(saved.category_3_sales_process).toMatchObject({
    discovery_questions: QUESTIONS,
    key_talking_points: TALKING_POINTS,
  });
  await expect(sectionHeader(page, 'Sales Playbook'), 'The playbook should no longer need attention')
    .not.toContainText('Needs attention');
  await page.screenshot({ path: 'screenshots/KnowledgeBase/SalesPlaybook-2-saved.png' });

  // Step 3: Reload: they are still there
  await reloadKnowledgeBase(page);
  await openSection(page, 'Sales Playbook');
  await expect(questionsField).toHaveValue(QUESTIONS.join('\n'));
  await expect(talkingPointsField).toHaveValue(TALKING_POINTS.join('\n'));
  await page.screenshot({ path: 'screenshots/KnowledgeBase/SalesPlaybook-3-after-reload.png' });
});
