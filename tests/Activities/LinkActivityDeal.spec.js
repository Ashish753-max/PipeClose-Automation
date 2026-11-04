// Activities > Link an activity to a Deal
//   1. Schedule a Meeting linked to the deal "Kunal - Google India Deal".
//      Picking the deal also links its person (Kunal) and organization (Google India).
//   2. The list shows the deal, person, email and organization, also after a reload
//   3. The Edit form shows the links
//   4. The deal's page lists the activity
//   5. Delete the activity
// Screenshots: screenshots/Activities/LinkDeal-*.png
const { test, expect } = require('@playwright/test');
const {
  uniqueTitle, openActivities, searchActivity, getCell, deleteActivity, deleteActivityById, openScheduleForm,
  openEditForm, chooseType, setTomorrow, clickSchedule, clickCancel, linkDeal, expectLinksInForm, expectLinksInRow,
  scrollToLinks,
} = require('../common/activity');

const DEAL = 'Kunal - Google India Deal';
const PERSON = 'Kunal';
const EMAIL = 'kunal.appnox@gmail.com';
const ORGANIZATION = 'Google India';

// If the test fails before deleting its activity, delete it here so no test data is left behind
let activityId = null;
test.afterEach(async ({ page }) => {
  if (activityId) await deleteActivityById(page, activityId);
  activityId = null;
});

test('Link an activity to a Deal', async ({ page }) => {
  const title = uniqueTitle('Link Deal');

  // Step 1: Schedule a Meeting linked to the deal
  await openActivities(page);
  const form = await openScheduleForm(page);
  await chooseType(form, 'Meeting');
  await form.getByPlaceholder('Activity title').fill(title);
  await setTomorrow(form, '10:00 AM', '10:30 AM');
  await linkDeal(page, form, DEAL);
  await expectLinksInForm(form, { deal: DEAL, person: PERSON, organization: ORGANIZATION });
  await scrollToLinks(form);
  await page.screenshot({ path: 'screenshots/Activities/LinkDeal-1-form.png' });
  const activity = await clickSchedule(page, form);
  activityId = activity.id;
  expect(activity.type).toBe('meeting');
  expect(activity.dealId, 'The deal should be saved').toBeTruthy();
  expect(activity.persons.map(person => person.firstName), 'The deal\'s person should be saved').toEqual([PERSON]);
  expect(activity.organization.name, 'The deal\'s organization should be saved').toBe(ORGANIZATION);

  // Step 2: The list shows the links, also after a reload. The deal is a link to the deal's page.
  let row = await searchActivity(page, title);
  await expect(row).toBeVisible();
  await expectLinksInRow(page, row, { deal: DEAL, person: PERSON, email: EMAIL, organization: ORGANIZATION });
  const dealLink = (await getCell(page, row, 'Linked to')).getByRole('link', { name: DEAL, exact: true });
  await expect(dealLink).toHaveAttribute('href', `/deals/${activity.dealId}`);
  await page.screenshot({ path: 'screenshots/Activities/LinkDeal-2-listed.png' });

  await page.reload();
  row = await searchActivity(page, title);
  await expectLinksInRow(page, row, { deal: DEAL, person: PERSON, email: EMAIL, organization: ORGANIZATION });

  // Step 3: The Edit form shows the links
  const editForm = await openEditForm(page, row);
  await expectLinksInForm(editForm, { deal: DEAL, person: PERSON, organization: ORGANIZATION });
  await scrollToLinks(editForm);
  await page.screenshot({ path: 'screenshots/Activities/LinkDeal-3-edit-form.png' });
  await clickCancel(editForm);

  // Step 4: The deal's page lists the activity (under "Focus")
  await dealLink.click();
  await expect(page).toHaveURL(new RegExp(`/deals/${activity.dealId}$`));
  await expect(page.getByRole('heading', { name: DEAL, level: 1 })).toBeVisible({ timeout: 30000 });
  const activityOnDeal = page.getByRole('main').getByText(title, { exact: true });
  await expect(activityOnDeal, 'The deal should list the activity').toBeVisible({ timeout: 30000 });
  await activityOnDeal.evaluate(element => element.scrollIntoView({ block: 'center' })); // for the screenshot
  await page.screenshot({ path: 'screenshots/Activities/LinkDeal-4-on-deal.png' });

  // Step 5: Delete the activity
  await page.goBack();
  await expect(page).toHaveURL(/\/activities/);
  row = await searchActivity(page, title);
  await deleteActivity(page, row);
  activityId = null;
});
