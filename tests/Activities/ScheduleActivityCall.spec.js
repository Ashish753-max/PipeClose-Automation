const { test } = require('@playwright/test');
const { scheduleActivity } = require('../common/scheduleActivity');

// Activities > + Activity > Call: title, tomorrow 10:00 AM to 10:30 AM, Schedule. Checks the call is saved and
// listed under Call with its due date and duration (see tests/common/scheduleActivity.js).
test('Activities - schedule a call', async ({ page }) => {
  await scheduleActivity(page, { type: 'Call', start: '10:00 AM', end: '10:30 AM' });
});
