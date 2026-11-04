// Activities > Edit an activity
//   1. Create a Call for tomorrow 10:00-10:30 AM
//   2. Open Edit: the form shows the saved values
//   3. Change the type, title, end time, priority, free/busy and note, and save
//   4. The list shows the changes, also after a reload
//   5. Open Edit again: the form shows the new values
//   6. Delete the activity
// Screenshots: screenshots/Activities/Edit-*.png
const { test, expect } = require('@playwright/test');
const {
  dueTomorrowAt, uniqueTitle, openActivities, searchActivity, getCell, deleteActivity, deleteActivityById, openEditForm,
  chooseType, expectType, setEndTime, priorityDropdown, freeBusyDropdown, chooseOption, clickSaveChanges, clickCancel,
  createActivity,
} = require('../common/activity');

const NOTE = 'Edited by the QA automation';

// If the test fails before deleting its activity, delete it here so no test data is left behind
let activityId = null;
test.afterEach(async ({ page }) => {
  if (activityId) await deleteActivityById(page, activityId);
  activityId = null;
});

test('Edit an activity', async ({ page }) => {
  const title = uniqueTitle('Edit');
  const newTitle = `${title} edited`;

  // Step 1: Create a Call for tomorrow 10:00-10:30 AM
  await openActivities(page);
  const activity = await createActivity(page, 'Call', title);
  activityId = activity.id;
  let row = await searchActivity(page, title);
  await expect(row).toBeVisible();
  await expect(await getCell(page, row, 'Duration')).toHaveText('30 min');
  await page.screenshot({ path: 'screenshots/Activities/Edit-1-scheduled.png' });

  // Step 2: Open Edit: the form shows the saved values
  let form = await openEditForm(page, row);
  await expect(form.getByPlaceholder('Activity title')).toHaveValue(title);
  await expectType(form, 'Call');
  await expect(form.getByPlaceholder('H:MM').first(), 'Start time').toHaveValue('10:00');
  await expect(form.getByPlaceholder('H:MM').last(), 'End time').toHaveValue('10:30');
  await expect(priorityDropdown(form)).toHaveText('Medium Priority');
  await expect(freeBusyDropdown(form)).toHaveText('Free');

  // Step 3: Change the type, title, end time, priority, free/busy and note, and save
  await chooseType(form, 'Meeting');
  await form.getByPlaceholder('Activity title').fill(newTitle);
  await setEndTime(form, '11:00 AM');
  await chooseOption(page, priorityDropdown(form), 'High Priority');
  await chooseOption(page, freeBusyDropdown(form), 'Busy');
  await form.getByPlaceholder('Add a note...').fill(NOTE);
  await page.screenshot({ path: 'screenshots/Activities/Edit-2-edit-form.png' });
  const saved = await clickSaveChanges(page, form);
  expect(saved).toMatchObject({ title: newTitle, type: 'meeting', priority: 'high', status: 'busy', note: NOTE });

  // Step 4: The list shows the changes, also after a reload
  await expect(await searchActivity(page, title), 'The old title should be gone').toHaveCount(0);
  row = await searchActivity(page, newTitle);
  await expectEditedRow(page, row);
  await page.screenshot({ path: 'screenshots/Activities/Edit-3-saved.png' });

  await page.reload();
  row = await searchActivity(page, newTitle);
  await expectEditedRow(page, row);

  // Step 5: Open Edit again: the form shows the new values
  form = await openEditForm(page, row);
  await expect(form.getByPlaceholder('Activity title')).toHaveValue(newTitle);
  await expectType(form, 'Meeting');
  await expect(form.getByPlaceholder('H:MM').last(), 'End time').toHaveValue('11:00');
  await expect(priorityDropdown(form)).toHaveText('High Priority');
  await expect(freeBusyDropdown(form)).toHaveText('Busy');
  await expect(form.getByPlaceholder('Add a note...')).toHaveValue(NOTE);
  await page.screenshot({ path: 'screenshots/Activities/Edit-4-edit-form-after-reload.png' });
  await clickCancel(form);

  // Step 6: Delete the activity
  await deleteActivity(page, row);
  activityId = null;
});

// The row after the edit: High priority, same start, one hour long (ends at 11:00 now), with the note
async function expectEditedRow(page, row) {
  await expect(row).toBeVisible();
  await expect(await getCell(page, row, 'Priority')).toHaveText('HIGH');
  await expect(await getCell(page, row, 'Due date'), 'The start should not change').toHaveAccessibleName(dueTomorrowAt('10:00 AM'));
  await expect(await getCell(page, row, 'Duration')).toHaveText('1 h');
  await expect(await getCell(page, row, 'Note')).toHaveText(NOTE);
}
