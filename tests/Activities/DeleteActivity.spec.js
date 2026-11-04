// Activities > Delete an activity
//   1. Create an Email activity for tomorrow
//   2. Delete it from its menu: it leaves the list, and searching for it finds nothing
//   3. Reload: it is still gone, also from the activities the page loads
// Screenshots: screenshots/Activities/Delete-*.png
const { test, expect } = require('@playwright/test');
const {
  uniqueTitle, openActivities, searchActivity, deleteActivity, deleteActivityById, createActivity,
} = require('../common/activity');

// If the test fails before deleting its activity, delete it here so no test data is left behind
let activityId = null;
test.afterEach(async ({ page }) => {
  if (activityId) await deleteActivityById(page, activityId);
  activityId = null;
});

test('Delete an activity', async ({ page }) => {
  const title = uniqueTitle('Delete');
  const noResults = page.getByRole('main').getByText('No activities found');

  // Step 1: Create an Email activity for tomorrow
  await openActivities(page);
  const activity = await createActivity(page, 'Email', title);
  activityId = activity.id;
  const row = await searchActivity(page, title);
  await expect(row).toBeVisible();
  await page.screenshot({ path: 'screenshots/Activities/Delete-1-listed.png' });

  // Step 2: Delete it from its menu, then search again: nothing is found.
  // (Search again because after a delete the app can show the full list while the old search text is still there.)
  await deleteActivity(page, row);
  activityId = null;
  await expect(await searchActivity(page, title)).toHaveCount(0);
  await expect(noResults, 'The search should find nothing').toBeVisible();
  await page.screenshot({ path: 'screenshots/Activities/Delete-2-deleted.png' });

  // Step 3: Reload: it is still gone
  const [listResponse] = await Promise.all([
    page.waitForResponse(res => res.url().endsWith('/api/activities') && res.request().method() === 'GET'),
    page.reload(),
  ]);
  const { activities } = await listResponse.json();
  const loadedIds = activities.map(item => item.id);
  expect(loadedIds, 'The deleted activity should not be loaded').not.toContain(activity.id);
  await expect(await searchActivity(page, title)).toHaveCount(0);
  await expect(noResults).toBeVisible();
  await page.screenshot({ path: 'screenshots/Activities/Delete-3-gone-after-reload.png' });
});
