const { test, expect } = require('@playwright/test');
const { fieldRow, errorToast } = require('../common/dealDetails');
const { openNewLead, valueLine } = require('../common/leadDetails');

// Every editable field in the left panel
const FIELDS = [
  ['Person', 'Phone'], ['Person', 'Email'], ['Person', 'First name'], ['Person', 'Last name'],
  ['Person', 'Job Title'], ['Person', 'Seniority'], ['Person', 'LinkedIn profile'], ['Person', 'Requirements'],
  ['Organization', 'Location'], ['Organization', 'Website'], ['Organization', 'LinkedIn profile'], ['Organization', 'Industry'],
  ['Organization', 'Annual revenue'], ['Organization', 'Number of employees'], ['Organization', 'Company size'],
];

test("Lead details - UX: edit icons work for keyboard and screen reader users", async ({ page }) => {
  test.setTimeout(240000);
  await openNewLead(page);

  // Each edit icon should say what it edits, like "Edit Phone"
  for (const [section, label] of FIELDS) {
    const row = fieldRow(page, section, label);
    await row.scrollIntoViewIfNeeded();
    await row.hover();
    await expect.soft(row.getByRole('button').first(), `${section} > ${label}: edit icon should be named "Edit ${label}"`)
      .toHaveAccessibleName(`Edit ${label}`);
  }

  // The Value pencil should be a button too, not only a clickable icon
  await valueLine(page).scrollIntoViewIfNeeded();
  await valueLine(page).hover();
  await expect.soft(valueLine(page).getByRole('button'), 'Summary > Value: edit icon should be a button').toHaveCount(1);

  // Tabbing through the Person and Organization sections should reach the edit buttons
  await page.mouse.move(0, 0);
  await page.getByRole('button', { name: 'Person', exact: true }).focus();
  const reached = [];
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    reached.push(await page.evaluate(() => {
      const el = document.activeElement;
      return el?.getAttribute('aria-label') || el?.innerText?.trim().split('\n')[0] || el?.tagName || '';
    }));
  }
  console.log(`Tab order from Person: ${reached.join(' > ')}`);
  expect.soft(reached.filter(name => name.startsWith('Edit ')), 'Tab should reach the field edit buttons').not.toEqual([]);

  // A failed save should be announced to screen readers (role alert/status or aria-live)
  const email = fieldRow(page, 'Person', 'Email');
  await email.hover();
  await email.getByRole('button', { name: 'Edit Email' }).click();
  await email.locator('input').first().fill('kunal.appnox@gmail.com'); // used by an existing deal, so the save fails
  await email.getByRole('button', { name: 'Save', exact: true }).click();
  const toast = errorToast(page);
  await expect(toast, 'An error toast should show').toBeVisible({ timeout: 10000 });
  await expect.soft(toast.locator('xpath=ancestor-or-self::*[@role="alert" or @role="status" or @aria-live]'),
    'The error toast should be announced to screen readers').not.toHaveCount(0);
  await page.screenshot({ path: 'screenshots/LeadDetails-UXAccessibility.png' });
});
