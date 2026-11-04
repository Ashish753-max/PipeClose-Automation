// tests/common/activity.js
// Helpers for the Activity scripts in tests/Activities/.
// Each test creates its own activity for tomorrow 10:00-10:30 AM (so it is in the To-do list and never overdue)
// and deletes it at the end.
const { expect, test } = require('@playwright/test');
const { loginStaging } = require('./createDeal');
const { setTime } = require('./scheduleActivity');

const BASE_URL = 'https://staging.pipeclose.com';

// ---------------------------------------------------------------- Dates and titles

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);

// Tomorrow as the date box takes it, e.g. "2026-11-05"
const TOMORROW = [
  tomorrow.getFullYear(),
  String(tomorrow.getMonth() + 1).padStart(2, '0'),
  String(tomorrow.getDate()).padStart(2, '0'),
].join('-');

// How the list shows a due date tomorrow, e.g. dueTomorrowAt('10:00 AM') -> "Nov 5 10:00 AM"
function dueTomorrowAt(time) {
  const month = tomorrow.toLocaleString('en-US', { month: 'short' });
  return `${month} ${tomorrow.getDate()} ${time}`;
}

// A title no other test run uses, e.g. uniqueTitle('Edit') -> "Edit - test 4821370"
function uniqueTitle(prefix) {
  const number = Date.now().toString().slice(-6) + test.info().parallelIndex;
  return `${prefix} - test ${number}`;
}

// ---------------------------------------------------------------- Activities list

// Logs in and opens Activities from the sidebar
async function openActivities(page) {
  await loginStaging(page);
  // Wait until login has landed on Deals: a sidebar click before that is lost
  await expect(page).toHaveURL(/\/deals/, { timeout: 30000 });
  await page.locator('a[href="/activities"]').first().click();
  await expect(page).toHaveURL(/\/activities/);
}

// Searches the list for an activity and returns its row.
// The row must match the whole subject, so "Edit - test 1" does not also find "Edit - test 1 edited".
// The row may not exist (for example after a delete), so the caller checks it.
async function searchActivity(page, title) {
  const searchBox = page.getByRole('main').getByPlaceholder('Search');
  await searchBox.fill('');
  // Wait for the results of this search: until they arrive, the list still shows the previous ones
  await Promise.all([
    page.waitForResponse(res => res.url().includes('/api/activities/search?')
      && new URL(res.url()).searchParams.get('query') === title),
    searchBox.fill(title),
  ]);
  const subjectCell = page.getByRole('cell', { name: title, exact: true });
  return page.getByRole('main').getByRole('row').filter({ has: subjectCell });
}

// Returns the row's cell under a column, e.g. getCell(page, row, 'Priority')
async function getCell(page, row, column) {
  const headings = await page.getByRole('main').getByRole('columnheader').allTextContents();
  const index = headings.map(heading => heading.trim()).indexOf(column);
  expect(index, `The list should have a "${column}" column`).toBeGreaterThan(-1);
  return row.getByRole('cell').nth(index);
}

// Opens the row's "..." menu and clicks an item: 'Mark as done', 'Mark as to do', 'Edit', 'Export' or 'Delete'
async function clickRowMenu(page, row, item) {
  await row.getByRole('cell').last().getByRole('button').click();
  await page.getByRole('button', { name: item, exact: true }).click();
}

// Deletes the activity from its row menu (the app deletes at once, without asking) and checks it leaves the list
async function deleteActivity(page, row) {
  const [response] = await Promise.all([
    page.waitForResponse(res => res.url().includes('/api/activities/delete/') && res.request().method() === 'DELETE'),
    clickRowMenu(page, row, 'Delete'),
  ]);
  expect(response.status(), 'Delete should succeed').toBe(200);
  await expect(row, 'The deleted activity should leave the list').toHaveCount(0);
}

// Cleanup after a failed test: deletes the activity through the API so no test data is left behind
async function deleteActivityById(page, id) {
  await page.request.delete(`${BASE_URL}/api/activities/delete/${id}`).catch(() => {});
}

// ---------------------------------------------------------------- Schedule and Edit forms
// They are the same form with a different heading.

async function openScheduleForm(page) {
  await page.getByRole('main').getByRole('button', { name: 'Activity', exact: true }).click();
  const form = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Schedule an activity' }) });
  await expect(form).toBeVisible();
  return form;
}

async function openEditForm(page, row) {
  await clickRowMenu(page, row, 'Edit');
  const form = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Edit activity' }) });
  await expect(form).toBeVisible();
  return form;
}

// Clicks a type: Call, Meeting, Task, Deadline, Email or Lunch.
// Choose the type before typing the title: until a title is typed, the form fills the title with the type.
async function chooseType(form, type) {
  const button = form.getByRole('button', { name: type, exact: true });
  await button.click();
  await expect(button, `${type} should be selected`).toHaveClass(/bg-primary/);
}

// The type button that is selected (highlighted) should be this one
async function expectType(form, type) {
  await expect(form.getByRole('button', { name: type, exact: true }), `${type} should be selected`)
    .toHaveClass(/bg-primary/);
}

// Sets the activity to tomorrow, e.g. setTomorrow(form, '10:00 AM', '10:30 AM')
async function setTomorrow(form, start, end) {
  await form.locator('input[type=date]').first().fill(TOMORROW);
  await setTime(form, 0, start);
  await setTime(form, 1, end);
}

// Sets only the end time, e.g. setEndTime(form, '11:00 AM')
async function setEndTime(form, end) {
  await setTime(form, 1, end);
}

// The Priority dropdown shows "Low Priority", "Medium Priority" or "High Priority"
function priorityDropdown(form) {
  return form.getByRole('combobox').filter({ hasText: 'Priority' });
}

// The Free/Busy dropdown shows "Free" or "Busy"
function freeBusyDropdown(form) {
  return form.getByRole('combobox').filter({ hasText: /^(Free|Busy)$/ });
}

// Picks an option in a dropdown, e.g. chooseOption(page, priorityDropdown(form), 'High Priority')
async function chooseOption(page, dropdown, option) {
  await dropdown.click();
  await page.getByRole('option', { name: option, exact: true }).click();
  await expect(dropdown).toHaveText(option);
}

// Returns the options of a dropdown, e.g. ['Free', 'Busy'], and closes it again
async function getOptions(page, dropdown) {
  await dropdown.click();
  const options = await page.getByRole('option').allTextContents();
  await page.keyboard.press('Escape'); // closes the dropdown only, not the form
  return options.map(option => option.trim());
}

// Clicks Schedule and returns the new activity as the server saved it
async function clickSchedule(page, form) {
  const [response] = await Promise.all([
    page.waitForResponse(res => res.url().endsWith('/api/activities') && res.request().method() === 'POST'),
    form.getByRole('button', { name: 'Schedule', exact: true }).click(),
  ]);
  expect(response.status(), 'Schedule should create the activity').toBe(201);
  await expect(form, 'The form should close').toBeHidden();
  const body = await response.json();
  return body.activity;
}

// Clicks Save Changes and returns the activity as the server saved it
async function clickSaveChanges(page, form) {
  const [response] = await Promise.all([
    page.waitForResponse(res => res.url().includes('/api/activities/') && res.request().method() === 'PUT'),
    form.getByRole('button', { name: 'Save Changes', exact: true }).click(),
  ]);
  expect(response.status(), 'Save Changes should save the activity').toBe(200);
  await expect(form, 'The form should close').toBeHidden();
  return response.json();
}

async function clickCancel(form) {
  await form.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(form).toBeHidden();
}

// Creates a basic activity for tomorrow 10:00-10:30 AM and returns it as saved
async function createActivity(page, type, title) {
  const form = await openScheduleForm(page);
  await chooseType(form, type);
  await form.getByPlaceholder('Activity title').fill(title);
  await setTomorrow(form, '10:00 AM', '10:30 AM');
  return clickSchedule(page, form);
}

// ---------------------------------------------------------------- "Linked to" part of the form

// Types in one of the "Linked to" search boxes and waits for its suggestions to load
async function searchLink(page, searchBox, apiPath, text) {
  await Promise.all([
    page.waitForResponse(res => {
      if (!res.url().includes(apiPath)) return false;
      const params = new URL(res.url()).searchParams;
      return params.get('q') === text || params.get('search') === text;
    }),
    searchBox.fill(text),
  ]);
}

// Links a deal. This also links the deal's person and organization.
async function linkDeal(page, form, dealTitle) {
  await searchLink(page, form.getByPlaceholder('Search deal or lead...'), '/api/deals/get?', dealTitle);
  // The suggestions list deals and leads; a deal reads "Deal <title> <person> · <organization>"
  await form.getByRole('button', { name: `Deal ${dealTitle}` }).first().click();
}

// Links a person: searches by name and picks the one with this email
async function linkPerson(page, form, name, email) {
  await searchLink(page, form.getByPlaceholder('Search or add person...'), '/api/persons/?', name);
  await form.getByText(email, { exact: true }).click();
}

async function linkOrganization(page, form, name) {
  await searchLink(page, form.getByPlaceholder('Search or add organization...'), '/api/organisations/search?', name);
  await form.getByText(name, { exact: true }).click();
}

// Checks the form's "Linked to" part. A linked item is shown in place of its search box.
// links: { deal, person, organization } as shown in the form. Leave out what is not linked.
async function expectLinksInForm(form, links) {
  await expectLink(form, 'Search deal or lead...', links.deal);
  await expectLink(form, 'Search or add person...', links.person);
  await expectLink(form, 'Search or add organization...', links.organization);
}

async function expectLink(form, placeholder, linkedName) {
  const searchBox = form.getByPlaceholder(placeholder);
  if (linkedName) {
    await expect(form.getByText(linkedName, { exact: true }), `${linkedName} should be linked`).toBeVisible();
    await expect(searchBox).toBeHidden();
  } else {
    await expect(searchBox, `Nothing should be linked in "${placeholder}"`).toBeVisible();
  }
}

// Checks the row's Linked to, Contact person, Email and Organization cells. They show "—" when nothing is linked.
// links: { deal, person, email, organization }. Leave out what is not linked.
async function expectLinksInRow(page, row, links) {
  await expect(await getCell(page, row, 'Linked to')).toHaveText(links.deal || '—');
  await expect(await getCell(page, row, 'Contact person')).toHaveText(links.person || '—');
  await expect(await getCell(page, row, 'Email')).toHaveText(links.email || '—');
  await expect(await getCell(page, row, 'Organization')).toHaveText(links.organization || '—');
}

// Brings the form's "Linked to" part into view for a screenshot (this also closes an open time list)
async function scrollToLinks(form) {
  const label = form.getByText('Linked to', { exact: true });
  await label.click();
  await label.evaluate(element => element.scrollIntoView({ block: 'center' }));
}

module.exports = {
  TOMORROW,
  dueTomorrowAt,
  uniqueTitle,
  openActivities,
  searchActivity,
  getCell,
  clickRowMenu,
  deleteActivity,
  deleteActivityById,
  openScheduleForm,
  openEditForm,
  chooseType,
  expectType,
  setTomorrow,
  setEndTime,
  priorityDropdown,
  freeBusyDropdown,
  chooseOption,
  getOptions,
  clickSchedule,
  clickSaveChanges,
  clickCancel,
  createActivity,
  linkDeal,
  linkPerson,
  linkOrganization,
  expectLinksInForm,
  expectLinksInRow,
  scrollToLinks,
};
