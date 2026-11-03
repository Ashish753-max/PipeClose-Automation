const { test } = require('@playwright/test');
const { scheduleActivity } = require('../common/scheduleActivity');

// Activities > + Activity > Lunch: title, tomorrow 1:00 PM to 1:45 PM, Schedule. Checks the lunch is saved and
// listed under Lunch with its due date and duration (see tests/common/scheduleActivity.js).
test('Activities - schedule a lunch', async ({ page }) => {
  await scheduleActivity(page, { type: 'Lunch', start: '1:00 PM', end: '1:45 PM' });
});
