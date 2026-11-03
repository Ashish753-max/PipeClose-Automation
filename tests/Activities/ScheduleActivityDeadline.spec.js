const { test } = require('@playwright/test');
const { scheduleActivity } = require('../common/scheduleActivity');

// Activities > + Activity > Deadline: title, tomorrow 5:00 PM to 5:15 PM, Schedule. Checks the deadline is saved and
// listed under Deadline with its due date and duration (see tests/common/scheduleActivity.js).
test('Activities - schedule a deadline', async ({ page }) => {
  await scheduleActivity(page, { type: 'Deadline', start: '5:00 PM', end: '5:15 PM' });
});
