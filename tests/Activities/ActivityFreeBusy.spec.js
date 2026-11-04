// Activities > Free/Busy
// One test starting from Busy and one starting from Free:
//   1. The Schedule form starts at Free and offers Free and Busy
//   2. Schedule a Meeting as Busy (or Free): the Edit form shows it
//   3. Switch it in the Edit form and save
//   4. Reload: the Edit form shows the new value
//   5. Delete the activity
// The list and the calendar do not show Free/Busy, so the Edit form is where the user sees it.
// Screenshots: screenshots/Activities/FreeBusy-*.png
const { test, expect } = require('@playwright/test');
const {
  uniqueTitle, openActivities, searchActivity, deleteActivity, deleteActivityById, openScheduleForm, openEditForm,
  chooseType, setTomorrow, freeBusyDropdown, chooseOption, getOptions, clickSchedule, clickSaveChanges, clickCancel,
} = require('../common/activity');

const TESTS = [
  { value: 'Busy', changeTo: 'Free' },
  { value: 'Free', changeTo: 'Busy' },
];

// If the test fails before deleting its activity, delete it here so no test data is left behind
let activityId = null;
test.afterEach(async ({ page }) => {
  if (activityId) await deleteActivityById(page, activityId);
  activityId = null;
});

for (const { value, changeTo } of TESTS) {
  test(`${value}, then changed to ${changeTo}`, async ({ page }) => {
    const title = uniqueTitle(value);

    // Step 1: The Schedule form starts at Free and offers Free and Busy
    await openActivities(page);
    const form = await openScheduleForm(page);
    await expect(freeBusyDropdown(form), 'New activities should be Free').toHaveText('Free');
    const options = await getOptions(page, freeBusyDropdown(form));
    expect(options).toEqual(['Free', 'Busy']);

    // Step 2: Schedule a Meeting as Busy (or Free): the Edit form shows it
    await chooseType(form, 'Meeting');
    await form.getByPlaceholder('Activity title').fill(title);
    await setTomorrow(form, '10:00 AM', '10:30 AM');
    await chooseOption(page, freeBusyDropdown(form), value);
    const activity = await clickSchedule(page, form);
    activityId = activity.id;
    expect(activity.status, 'Saved as').toBe(value.toLowerCase()); // the API calls Free/Busy "status"

    let row = await searchActivity(page, title);
    await expect(row).toBeVisible();
    let editForm = await openEditForm(page, row);
    await expect(freeBusyDropdown(editForm)).toHaveText(value);
    await page.screenshot({ path: `screenshots/Activities/FreeBusy-${value}-1-edit-form.png` });

    // Step 3: Switch it in the Edit form and save
    await chooseOption(page, freeBusyDropdown(editForm), changeTo);
    const saved = await clickSaveChanges(page, editForm);
    expect(saved.status, 'Saved as').toBe(changeTo.toLowerCase());

    // Step 4: Reload: the Edit form shows the new value
    await page.reload();
    row = await searchActivity(page, title);
    await expect(row).toBeVisible();
    editForm = await openEditForm(page, row);
    await expect(freeBusyDropdown(editForm)).toHaveText(changeTo);
    await page.screenshot({ path: `screenshots/Activities/FreeBusy-${value}-2-changed-to-${changeTo}.png` });
    await clickCancel(editForm);

    // Step 5: Delete the activity
    await deleteActivity(page, row);
    activityId = null;
  });
}
