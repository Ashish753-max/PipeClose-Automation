// Activities > Mark as done
//   1. Create a Task for tomorrow: it starts as "to do"
//   2. Mark it as done from its menu: green tick, the menu now offers "Mark as to do", it leaves the To-do list
//   3. Reload: it is still done
//   4. Mark it as to do again: empty circle, back in the To-do list
//   5. Delete the activity
// Screenshots: screenshots/Activities/MarkDone-*.png
const { test, expect } = require('@playwright/test');
const {
  uniqueTitle, openActivities, searchActivity, getCell, clickRowMenu, deleteActivity, deleteActivityById, createActivity,
} = require('../common/activity');

// If the test fails before deleting its activity, delete it here so no test data is left behind
let activityId = null;
test.afterEach(async ({ page }) => {
  if (activityId) await deleteActivityById(page, activityId);
  activityId = null;
});

test('Mark an activity as done', async ({ page }) => {
  const title = uniqueTitle('MarkDone');

  // Step 1: Create a Task for tomorrow: it starts as "to do"
  await openActivities(page);
  const activity = await createActivity(page, 'Task', title);
  activityId = activity.id;
  expect(activity.isDone).toBe(false);
  const row = await searchActivity(page, title);
  await expect(row).toBeVisible();
  await expectDone(page, row, false);
  await expectMenuItem(page, row, 'Mark as done');
  await expectInTodoList(page, row, true);
  await page.screenshot({ path: 'screenshots/Activities/MarkDone-1-in-todo.png' });
  await turnOffTodoList(page, title);

  // Step 2: Mark it as done
  await markAs(page, row, 'Mark as done', true);
  await expectDone(page, row, true);
  await page.screenshot({ path: 'screenshots/Activities/MarkDone-2-done.png' });
  await expectMenuItem(page, row, 'Mark as to do');
  await expectInTodoList(page, row, false);
  await page.screenshot({ path: 'screenshots/Activities/MarkDone-3-not-in-todo.png' });
  await turnOffTodoList(page, title);

  // Step 3: Reload: it is still done
  await page.reload();
  await searchActivity(page, title);
  await expect(row).toBeVisible();
  await expectDone(page, row, true);

  // Step 4: Mark it as to do again
  await markAs(page, row, 'Mark as to do', false);
  await expectDone(page, row, false);
  await expectMenuItem(page, row, 'Mark as done');
  await expectInTodoList(page, row, true);
  await page.screenshot({ path: 'screenshots/Activities/MarkDone-4-to-do-again.png' });
  await turnOffTodoList(page, title);

  // Step 5: Delete the activity
  await deleteActivity(page, row);
  activityId = null;
});

// Clicks "Mark as done" or "Mark as to do" in the row menu and checks the server saved it
async function markAs(page, row, menuItem, done) {
  const [response] = await Promise.all([
    page.waitForResponse(res => res.url().endsWith('/mark-done') && res.request().method() === 'PATCH'),
    clickRowMenu(page, row, menuItem),
  ]);
  expect(response.status(), `${menuItem} should succeed`).toBe(200);
  const activity = await response.json();
  expect(activity.isDone, `The activity should be saved as ${done ? 'done' : 'to do'}`).toBe(done);
}

// The circle in the Done column: green with a tick when done, empty when to do
async function expectDone(page, row, done) {
  const circle = (await getCell(page, row, 'Done')).locator('div.rounded-full');
  if (done) {
    await expect(circle, 'The Done circle should be green').toHaveClass(/bg-green-500/);
    await expect(circle.locator('svg.lucide-check'), 'The Done circle should have a tick').toBeVisible();
  } else {
    await expect(circle, 'The Done circle should be empty').toHaveClass(/border-slate-300/);
    await expect(circle.locator('svg')).toHaveCount(0);
  }
}

// The row menu offers "Mark as done" for a to-do activity, and "Mark as to do" for a done one
async function expectMenuItem(page, row, menuItem) {
  const otherItem = menuItem === 'Mark as done' ? 'Mark as to do' : 'Mark as done';
  const menuButton = row.getByRole('cell').last().getByRole('button');
  await menuButton.click();
  await expect(page.getByRole('button', { name: menuItem, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: otherItem, exact: true })).toHaveCount(0);
  // The menu does not close on Escape; clicking its button again closes it
  await menuButton.click();
  await expect(page.getByRole('button', { name: menuItem, exact: true })).toBeHidden();
}

// Turns on the To-do filter and checks whether the activity is listed there (the filter ignores the search box)
async function expectInTodoList(page, row, listed) {
  const todoFilter = page.getByRole('main').getByText('To-do', { exact: true });
  await Promise.all([
    page.waitForResponse(res => new URL(res.url()).searchParams.get('dateFilter') === 'todo'),
    todoFilter.click(),
  ]);
  await expect(todoFilter, 'The To-do filter should be on').toHaveClass(/text-primary/);
  if (listed) {
    await expect(row, 'The activity should be in the To-do list').toBeVisible();
  } else {
    await expect(row, 'The activity should not be in the To-do list').toHaveCount(0);
  }
}

// Turns the To-do filter off and searches for the activity again
async function turnOffTodoList(page, title) {
  const todoFilter = page.getByRole('main').getByText('To-do', { exact: true });
  await todoFilter.click();
  await expect(todoFilter, 'The To-do filter should be off').not.toHaveClass(/text-primary/);
  await searchActivity(page, title);
}
