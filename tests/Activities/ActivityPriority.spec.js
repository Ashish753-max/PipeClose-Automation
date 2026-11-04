// Activities > Priority
// One test per priority (Low, Medium, High):
//   1. The Schedule form starts at Medium and offers Low, Medium and High
//   2. Schedule a Task with the priority: the list shows it (e.g. "HIGH")
//   3. Change the priority in the Edit form: the list shows the new one
//   4. Reload: the list and the Edit form still show the new priority
//   5. Delete the activity
// Screenshots: screenshots/Activities/Priority<priority>-*.png
const { test, expect } = require('@playwright/test');
const {
  uniqueTitle, openActivities, searchActivity, getCell, deleteActivity, deleteActivityById, openScheduleForm,
  openEditForm, chooseType, setTomorrow, priorityDropdown, chooseOption, getOptions, clickSchedule, clickSaveChanges,
  clickCancel,
} = require('../common/activity');

// Each priority is used once when scheduling and once when editing
const TESTS = [
  { priority: 'Low', changeTo: 'High' },
  { priority: 'Medium', changeTo: 'Low' },
  { priority: 'High', changeTo: 'Medium' },
];

// If the test fails before deleting its activity, delete it here so no test data is left behind
let activityId = null;
test.afterEach(async ({ page }) => {
  if (activityId) await deleteActivityById(page, activityId);
  activityId = null;
});

for (const { priority, changeTo } of TESTS) {
  test(`Priority ${priority}, then changed to ${changeTo}`, async ({ page }) => {
    const title = uniqueTitle(`Priority ${priority}`);

    // Step 1: The Schedule form starts at Medium and offers Low, Medium and High
    await openActivities(page);
    const form = await openScheduleForm(page);
    await expect(priorityDropdown(form), 'New activities should be Medium').toHaveText('Medium Priority');
    const options = await getOptions(page, priorityDropdown(form));
    expect(options).toEqual(['Low Priority', 'Medium Priority', 'High Priority']);

    // Step 2: Schedule a Task with the priority
    await chooseType(form, 'Task');
    await form.getByPlaceholder('Activity title').fill(title);
    await setTomorrow(form, '10:00 AM', '10:30 AM');
    await chooseOption(page, priorityDropdown(form), `${priority} Priority`);
    const activity = await clickSchedule(page, form);
    activityId = activity.id;
    expect(activity.priority, 'Saved priority').toBe(priority.toLowerCase());
    let row = await searchActivity(page, title);
    await expectPriorityInList(page, row, priority);
    await page.screenshot({ path: `screenshots/Activities/Priority${priority}-1-listed.png` });

    // Step 3: Change the priority in the Edit form
    let editForm = await openEditForm(page, row);
    await expect(priorityDropdown(editForm)).toHaveText(`${priority} Priority`);
    await chooseOption(page, priorityDropdown(editForm), `${changeTo} Priority`);
    const saved = await clickSaveChanges(page, editForm);
    expect(saved.priority, 'Saved priority').toBe(changeTo.toLowerCase());
    await expectPriorityInList(page, row, changeTo);

    // Step 4: Reload: the list and the Edit form still show the new priority
    await page.reload();
    row = await searchActivity(page, title);
    await expectPriorityInList(page, row, changeTo);
    editForm = await openEditForm(page, row);
    await expect(priorityDropdown(editForm)).toHaveText(`${changeTo} Priority`);
    await clickCancel(editForm);
    await page.screenshot({ path: `screenshots/Activities/Priority${priority}-2-changed-to-${changeTo}.png` });

    // Step 5: Delete the activity
    await deleteActivity(page, row);
    activityId = null;
  });
}

// The Priority column shows the priority in capitals, e.g. "HIGH"
async function expectPriorityInList(page, row, priority) {
  await expect(row).toBeVisible();
  await expect(await getCell(page, row, 'Priority')).toHaveText(priority.toUpperCase());
}
