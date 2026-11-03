// tests/common/scheduleActivity.js
// Shared flow for the Schedule activity scripts (tests/Activities/ScheduleActivity*.spec.js)
const { expect, test } = require('@playwright/test');
const { loginStaging } = require('./createDeal');

const pad = n => String(n).padStart(2, '0');

// "1:45 PM" -> "13:45"
function to24h(time) {
  const [clock, meridiem] = time.split(' ');
  const [h, m] = clock.split(':').map(Number);
  return `${pad((h % 12) + (meridiem === 'PM' ? 12 : 0))}:${pad(m)}`;
}

const minutes = time => to24h(time).split(':').reduce((h, m) => h * 60 + Number(m));

/** Types a time ("1:45 PM") into the start (0) or end (1) time box and sets its AM/PM toggle. */
async function setTime(form, index, time) {
  const [clock, meridiem] = time.split(' ');
  await form.getByPlaceholder('H:MM').nth(index).fill(clock);
  // Toggling the start's AM/PM also changes the end's, so the end is set after the start
  const toggle = form.getByRole('button', { name: /^(AM|PM)$/ }).nth(index);
  if ((await toggle.innerText()) !== meridiem) await toggle.click();
  await expect(toggle).toHaveText(meridiem);
}

/**
 * Logs in, opens Activities and schedules an activity of the given type for tomorrow with a title and start
 * and end times, then checks it is saved and listed under its type with its due date and duration, also after
 * a reload. Deletes it at the end. Screenshots are saved in screenshots/Activities/.
 * @param {import('@playwright/test').Page} page
 * @param {{ type: 'Call'|'Meeting'|'Task'|'Deadline'|'Email'|'Lunch', start: string, end: string }} activity
 *   start and end as the form shows them, e.g. '11:30 AM'
 */
async function scheduleActivity(page, { type, start, end }) {
  const shot = step => page.screenshot({ path: `screenshots/Activities/Schedule${type}-${step}.png` });
  const title = `${type} - test ${Date.now().toString().slice(-6)}${test.info().parallelIndex}`;
  const day = new Date();
  day.setDate(day.getDate() + 1);
  const date = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
  const due = `${day.toLocaleString('en-US', { month: 'short' })} ${day.getDate()} ${start}`; // "Nov 4 10:30 AM"
  const duration = `${minutes(end) - minutes(start)} min`;

  await loginStaging(page);
  await page.locator('a[href="/activities"]').first().click();
  await expect(page).toHaveURL(/\/activities/);
  const main = page.getByRole('main');

  // Open the form and pick the type (the title follows the type until one is typed)
  await main.getByRole('button', { name: 'Activity', exact: true }).click();
  const form = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Schedule an activity' }) });
  await expect(form).toBeVisible();
  const typeButton = form.getByRole('button', { name: type, exact: true });
  await typeButton.click();
  await expect(typeButton, `${type} should be selected`).toHaveClass(/bg-primary/);
  const titleField = form.getByPlaceholder('Activity title');
  await expect(titleField, 'Title should follow the chosen type').toHaveValue(type);

  // Title, date and times
  await titleField.fill(title);
  const dates = form.locator('input[type=date]');
  await dates.first().fill(date);
  await expect(dates.last(), 'End date should follow the start date').toHaveValue(date);
  await setTime(form, 0, start);
  await setTime(form, 1, end);
  // Both times as picked (setting the end must not change the start)
  for (const [i, time] of [start, end].entries()) {
    await expect(form.getByPlaceholder('H:MM').nth(i)).toHaveValue(time.split(' ')[0]);
    await expect(form.getByRole('button', { name: /^(AM|PM)$/ }).nth(i)).toHaveText(time.split(' ')[1]);
  }
  const assignee = (await form.getByRole('combobox').filter({ hasText: '(You)' }).innerText()).replace('(You)', '').trim();
  await shot('1-filled');

  // Schedule
  const [created] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/api/activities') && r.request().method() === 'POST', { timeout: 30000 }),
    form.getByRole('button', { name: 'Schedule', exact: true }).click(),
  ]);
  expect(created.status(), `Schedule API returned ${created.status()}`).toBe(201);
  const startAt = `${date}T${to24h(start)}:00`;
  const endAt = `${date}T${to24h(end)}:00`;
  expect(created.request().postDataJSON()).toMatchObject({ title, type: type.toLowerCase(), startAt, endAt, isAllDay: false });
  const { message, activity } = await created.json();
  expect(message).toBe('Activity created successfully');
  // Stored in UTC: the same moments as the local times picked
  expect(activity.startAt, 'Saved start time').toBe(new Date(startAt).toISOString());
  expect(activity.endAt, 'Saved end time').toBe(new Date(endAt).toISOString());
  await expect(form, 'Form should close once the activity is scheduled').toBeHidden();
  console.log(`${type} "${title}" scheduled for ${due}, ${duration}`);

  // Listed with its due date, duration, priority and assignee
  const search = main.getByPlaceholder('Search');
  const row = main.getByRole('row').filter({ hasText: title });
  const expectListed = async () => {
    // Wait for the search itself: the full list already shows the activity before the search is sent,
    // and a type filter clicked while the search is pending is lost
    await search.fill('');
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/activities/search?') && new URL(r.url()).searchParams.get('query') === title,
        { timeout: 30000 }),
      search.fill(title),
    ]);
    await expect(row, `${title} should be listed`).toBeVisible();
    await expect(row.getByRole('cell', { name: due, exact: true }), 'Due date should be the start').toBeVisible();
    await expect(row.getByRole('cell', { name: duration, exact: true }), 'Duration should be the scheduled length').toBeVisible();
    await expect(row.getByRole('cell', { name: 'MEDIUM', exact: true }), 'Priority should be the default Medium').toBeVisible();
    await expect(row).toContainText(assignee);
  };
  await expectListed();
  await shot('2-listed');

  // Listed under its own type only. A type filter shows every activity of that type (it ignores the search),
  // and each one loads its list, so wait for that list: a slower earlier one can replace it
  const showType = name => Promise.all([
    page.waitForResponse(r => new URL(r.url()).searchParams.get('type') === name.toLowerCase(), { timeout: 30000 }),
    main.getByRole('button', { name, exact: true }).click(),
  ]);
  const other = type === 'Call' ? 'Meeting' : 'Call';
  await showType(other);
  await expect(row, `${title} should not be listed under ${other}`).toHaveCount(0);
  await showType(type);
  await expect(row, `${title} should be listed under ${type}`).toBeVisible();
  await shot('3-type-filter');

  // Still there after a reload
  await page.reload();
  await expectListed();

  // Delete it so the lists stay on one page for the next runs
  await row.getByRole('cell').last().getByRole('button').click();
  const [deleted] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith(`/api/activities/delete/${activity.id}`), { timeout: 30000 }),
    page.getByRole('button', { name: 'Delete', exact: true }).click(),
  ]);
  expect(deleted.status(), `Delete API returned ${deleted.status()}`).toBe(200);
  await expect(row).toHaveCount(0);
}

module.exports = { scheduleActivity };
