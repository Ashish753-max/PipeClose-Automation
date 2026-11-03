const { test } = require('@playwright/test');
const { scheduleActivity } = require('../common/scheduleActivity');

// Activities > + Activity > Meeting: title, tomorrow 11:30 AM to 12:15 PM, Schedule. Checks the meeting is saved and
// listed under Meeting with its due date and duration (see tests/common/scheduleActivity.js).
test('Activities - schedule a meeting', async ({ page }) => {
  await scheduleActivity(page, { type: 'Meeting', start: '11:30 AM', end: '12:15 PM' });
});
