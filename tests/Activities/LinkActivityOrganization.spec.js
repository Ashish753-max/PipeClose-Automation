// Activities > Link an activity to an Organization
//   1. Schedule a Meeting linked to the organization Google India only (no deal, no person)
//   2. The list shows the organization, also after a reload
//   3. The Edit form shows the organization
//   4. Delete the activity
// (An organization's page does not list activities, so it is not checked.)
// Screenshots: screenshots/Activities/LinkOrganization-*.png
const { test, expect } = require('@playwright/test');
const {
  uniqueTitle, openActivities, searchActivity, deleteActivity, deleteActivityById, openScheduleForm, openEditForm,
  chooseType, setTomorrow, clickSchedule, clickCancel, linkOrganization, expectLinksInForm, expectLinksInRow,
  scrollToLinks,
} = require('../common/activity');

const ORGANIZATION = 'Google India';

// If the test fails before deleting its activity, delete it here so no test data is left behind
let activityId = null;
test.afterEach(async ({ page }) => {
  if (activityId) await deleteActivityById(page, activityId);
  activityId = null;
});

test('Link an activity to an Organization', async ({ page }) => {
  const title = uniqueTitle('Link Organization');

  // Step 1: Schedule a Meeting linked to the organization
  await openActivities(page);
  const form = await openScheduleForm(page);
  await chooseType(form, 'Meeting');
  await form.getByPlaceholder('Activity title').fill(title);
  await setTomorrow(form, '10:00 AM', '10:30 AM');
  await linkOrganization(page, form, ORGANIZATION);
  await expectLinksInForm(form, { organization: ORGANIZATION });
  await scrollToLinks(form);
  await page.screenshot({ path: 'screenshots/Activities/LinkOrganization-1-form.png' });
  const activity = await clickSchedule(page, form);
  activityId = activity.id;
  expect(activity.type).toBe('meeting');
  expect(activity.organization.name, 'The organization should be saved').toBe(ORGANIZATION);
  expect(activity.dealId, 'No deal should be saved').toBeNull();
  expect(activity.persons, 'No person should be saved').toEqual([]);

  // Step 2: The list shows the organization, also after a reload
  let row = await searchActivity(page, title);
  await expect(row).toBeVisible();
  await expectLinksInRow(page, row, { organization: ORGANIZATION });
  await page.screenshot({ path: 'screenshots/Activities/LinkOrganization-2-listed.png' });

  await page.reload();
  row = await searchActivity(page, title);
  await expectLinksInRow(page, row, { organization: ORGANIZATION });

  // Step 3: The Edit form shows the organization
  const editForm = await openEditForm(page, row);
  await expectLinksInForm(editForm, { organization: ORGANIZATION });
  await scrollToLinks(editForm);
  await page.screenshot({ path: 'screenshots/Activities/LinkOrganization-3-edit-form.png' });
  await clickCancel(editForm);

  // Step 4: Delete the activity
  await deleteActivity(page, row);
  activityId = null;
});
