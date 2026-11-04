// Activities > Link an activity to a Person
//   1. Schedule a Meeting linked to the person Tanmay Bisht only (no deal, no organization)
//   2. The list shows the person and their email, also after a reload
//   3. The Edit form shows the person
//   4. Delete the activity
// (A person's page does not list activities, so it is not checked.)
// Screenshots: screenshots/Activities/LinkPerson-*.png
const { test, expect } = require('@playwright/test');
const {
  uniqueTitle, openActivities, searchActivity, deleteActivity, deleteActivityById, openScheduleForm, openEditForm,
  chooseType, setTomorrow, clickSchedule, clickCancel, linkPerson, expectLinksInForm, expectLinksInRow, scrollToLinks,
} = require('../common/activity');

const PERSON = 'Tanmay Bisht';
const EMAIL = 'tanmay.bisht@appnox.ai';

// If the test fails before deleting its activity, delete it here so no test data is left behind
let activityId = null;
test.afterEach(async ({ page }) => {
  if (activityId) await deleteActivityById(page, activityId);
  activityId = null;
});

test('Link an activity to a Person', async ({ page }) => {
  const title = uniqueTitle('Link Person');

  // Step 1: Schedule a Meeting linked to the person
  await openActivities(page);
  const form = await openScheduleForm(page);
  await chooseType(form, 'Meeting');
  await form.getByPlaceholder('Activity title').fill(title);
  await setTomorrow(form, '10:00 AM', '10:30 AM');
  await linkPerson(page, form, PERSON, EMAIL);
  await expectLinksInForm(form, { person: PERSON });
  await scrollToLinks(form);
  await page.screenshot({ path: 'screenshots/Activities/LinkPerson-1-form.png' });
  const activity = await clickSchedule(page, form);
  activityId = activity.id;
  expect(activity.type).toBe('meeting');
  const savedPersons = activity.persons.map(person => `${person.firstName} ${person.lastName}`);
  expect(savedPersons, 'The person should be saved').toEqual([PERSON]);
  expect(activity.dealId, 'No deal should be saved').toBeNull();
  expect(activity.organizationId, 'No organization should be saved').toBeNull();

  // Step 2: The list shows the person and their email, also after a reload
  let row = await searchActivity(page, title);
  await expect(row).toBeVisible();
  await expectLinksInRow(page, row, { person: PERSON, email: EMAIL });
  await page.screenshot({ path: 'screenshots/Activities/LinkPerson-2-listed.png' });

  await page.reload();
  row = await searchActivity(page, title);
  await expectLinksInRow(page, row, { person: PERSON, email: EMAIL });

  // Step 3: The Edit form shows the person
  const editForm = await openEditForm(page, row);
  await expectLinksInForm(editForm, { person: PERSON });
  await scrollToLinks(editForm);
  await page.screenshot({ path: 'screenshots/Activities/LinkPerson-3-edit-form.png' });
  await clickCancel(editForm);

  // Step 4: Delete the activity
  await deleteActivity(page, row);
  activityId = null;
});
