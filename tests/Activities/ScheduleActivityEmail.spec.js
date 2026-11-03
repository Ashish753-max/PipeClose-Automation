const { test } = require('@playwright/test');
const { scheduleActivity } = require('../common/scheduleActivity');

// Activities > + Activity > Email: title, tomorrow 9:00 AM to 9:15 AM, Schedule. Checks the email is saved and
// listed under Email with its due date and duration (see tests/common/scheduleActivity.js).
test('Activities - schedule an email', async ({ page }) => {
  await scheduleActivity(page, { type: 'Email', start: '9:00 AM', end: '9:15 AM' });
});
