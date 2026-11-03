const { test } = require('@playwright/test');
const { scheduleActivity } = require('../common/scheduleActivity');

// Activities > + Activity > Task: title, tomorrow 2:00 PM to 2:45 PM, Schedule. Checks the task is saved and
// listed under Task with its due date and duration (see tests/common/scheduleActivity.js).
test('Activities - schedule a task', async ({ page }) => {
  await scheduleActivity(page, { type: 'Task', start: '2:00 PM', end: '2:45 PM' });
});
