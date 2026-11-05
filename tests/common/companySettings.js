// tests/common/companySettings.js
// Helpers for the Company settings scripts in tests/Settings/.
// Every save changes the one real company record on staging, so a test reads the record when it opens
// the page (openCompanySettings) and puts it back at the end (restoreCompany).
const { expect } = require('@playwright/test');
const { loginStaging } = require('./createDeal');

const BASE_URL = 'https://staging.pipeclose.com';
const UPDATE_URL = /\/api\/companies\/update-company\/\d+$/;
const SAVED_MESSAGE = 'Company settings updated successfully';

// The Company Details fields, in the order the form shows them
const FIELDS = ['Company name', 'Company domain', 'Company size', 'Location', 'Website', 'Timezone', 'Language',
  'Currency', 'Description'];

// Where each text field is stored in the company record
const KEYS = {
  'Company name': 'name',
  'Company domain': 'companyDomain',
  Location: 'companyLocation',
  Website: 'companyWebsite',
  Description: 'description',
};

// Search box of each list (Timezone, Language, Currency)
const SEARCH = {
  Timezone: /^Search by city, country or zone/,
  Language: /^Search language/,
  Currency: /^Search currency/,
};

// ---------------------------------------------------------------- Company record

// The company as saved on the server
async function readCompany(page) {
  const response = await page.request.get(`${BASE_URL}/api/companies/get-my-companies`);
  expect(response.ok(), `Reading the company returned ${response.status()}`).toBeTruthy();
  return (await response.json()).data.companies[0];
}

// Saves the company back as it was read, with the same fields the form sends
async function restoreCompany(page, company) {
  const response = await page.request.put(`${BASE_URL}/api/companies/update-company/${company.id}`, {
    data: {
      name: company.name,
      companyDomain: company.companyDomain,
      companySize: company.companySize,
      industry: company.industry,
      companyLocation: company.companyLocation,
      companyWebsite: company.companyWebsite,
      phone: company.phone ?? '',
      timezone: company.timezone,
      dateFormat: company.dateFormat ?? 'en-us',
      locale: company.locale,
      currency: company.currency,
      billingStatus: company.billingStatus,
      description: company.description ?? '',
    },
  });
  expect(response.ok(), `Restoring the company returned ${response.status()}`).toBeTruthy();
  console.log('Company settings restored');
}

// ---------------------------------------------------------------- Page

// Logs in, opens Settings from the sidebar, then Company settings. Returns the saved company record.
async function openCompanySettings(page) {
  await loginStaging(page);
  await expect(page).toHaveURL(/\/deals/, { timeout: 30000 });

  // The sidebar starts collapsed, and collapsed it does not show the Settings link
  const expand = page.getByRole('button', { name: 'Expand sidebar' });
  await expand.or(page.getByRole('button', { name: 'Collapse sidebar' })).first().waitFor({ timeout: 30000 });
  if (await expand.isVisible()) await expand.click();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page).toHaveURL(/\/settings/);

  await page.getByRole('link', { name: 'Company settings' }).click();
  await expect(page).toHaveURL(/\/settings\/company/);
  await expect(page.getByRole('heading', { name: 'Company settings', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Company Details', exact: true })).toBeVisible();

  const company = await readCompany(page);
  await expect(textBox(page, 'Company name'), 'The form should show the saved company name')
    .toHaveValue(company.name, { timeout: 30000 });
  return company;
}

// Reloads the page and waits for the form to show the saved company. Returns the company record.
async function reloadCompanySettings(page) {
  await page.reload();
  const company = await readCompany(page);
  await expect(textBox(page, 'Company name')).toHaveValue(company.name, { timeout: 30000 });
  return company;
}

// The box next to a label, e.g. field(page, 'Website')
function field(page, label) {
  return page.locator('label', { hasText: new RegExp(`^${label}$`) }).locator('xpath=following-sibling::div[1]');
}

// The labels of the form, in order
async function fieldLabels(page) {
  return page.locator('label', { hasText: /^Company name$/ }).locator('xpath=..').locator('label').allInnerTexts();
}

// The input of a text field (Company name, Company domain, Location, Website, Description)
function textBox(page, label) {
  return field(page, label).locator('input, textarea').first();
}

// The button of a list field, showing the chosen value (Timezone, Language, Currency)
function pickerButton(page, label) {
  return field(page, label).getByRole('button').first();
}

// Clicks Save Changes, waits for the update and the success message, and returns the saved record
async function saveChanges(page) {
  const [response] = await Promise.all([
    page.waitForResponse(res => UPDATE_URL.test(res.url()) && res.request().method() === 'PUT'),
    page.getByRole('button', { name: 'Save Changes' }).click(),
  ]);
  expect(response.ok(), `Save returned ${response.status()}`).toBeTruthy();
  await expect(page.getByText(SAVED_MESSAGE), 'Success message should show').toBeVisible();
  return (await response.json()).data;
}

// ---------------------------------------------------------------- Text fields

// A value as the log and error messages show it: quoted, new lines as \n, long values cut
const quote = value => JSON.stringify(value.length > 40 ? `${value.slice(0, 40)}...` : value);

/**
 * Types a valid value, saves it and checks it is stored and still shown after a reload.
 * Soft assertions, so every value in a test is checked and reported.
 * @param {string} [stored] the value expected after saving, when the app changes it (defaults to value)
 */
async function expectSaved(page, label, value, stored = value) {
  const what = `${label} ${quote(value)}`;
  await textBox(page, label).fill(value);
  const saved = await saveChanges(page);
  expect.soft(saved[KEYS[label]], `${what} should be saved as ${quote(stored)}`).toBe(stored);

  await reloadCompanySettings(page);
  await expect.soft(textBox(page, label), `${what} should still show after a reload`).toHaveValue(stored);
  const savedAs = saved[KEYS[label]];
  console.log(`${what}: ${savedAs === undefined ? 'NOT SAVED - missing from the saved company' : `saved as ${quote(savedAs)}`}`);
}

// Error messages on the page: toasts at the top right and messages under the field
async function errorMessages(page, label) {
  const toasts = await page.locator('#root > div.fixed.top-4').allInnerTexts();
  const inline = await field(page, label).locator('p, [role="alert"], [class*="text-red"], [class*="destructive"]')
    .allInnerTexts();
  return [...toasts, ...inline].join(' ').replace(SAVED_MESSAGE, '').replace(/\s+/g, ' ').trim();
}

/**
 * Types an invalid value, clicks Save and checks it is refused: the stored value does not change and
 * an error message is shown (a toast, a message under the field or the browser's own message).
 * If it is saved anyway, the company is restored so the next check starts from the original value.
 * Soft assertion, so every invalid value in a test is checked and reported.
 * @param {object} company the record read when the page was opened
 */
async function expectRefused(page, company, label, invalid) {
  const what = `${label} ${quote(invalid)}`;
  const key = KEYS[label];
  await reloadCompanySettings(page);

  const box = textBox(page, label);
  await box.fill(invalid);
  const update = page.waitForResponse(res => UPDATE_URL.test(res.url()) && res.request().method() === 'PUT',
    { timeout: 5000 }).catch(() => null);
  await page.getByRole('button', { name: 'Save Changes' }).click({ timeout: 3000 }).catch(() => {}); // a disabled Save also refuses it
  await update;
  const error = [await errorMessages(page, label), await box.evaluate(input => input.validationMessage)]
    .filter(Boolean).join(' ');

  const stored = (await readCompany(page))[key];
  const changed = stored !== company[key];
  const problems = [];
  if (changed) problems.push(`saved - the company now has "${stored}"`);
  else if (!error) problems.push('not saved, but no error message was shown');
  expect.soft(problems, `${what} should be refused`).toEqual([]);
  console.log(`${what}: ${problems.length ? `NOT VALIDATED - ${problems.join('; ')}` : `refused - "${error}"`}`);

  if (changed) await restoreCompany(page, company);
}

// ---------------------------------------------------------------- Location

// Types in the Location box, waits for the search results and returns the suggestion rows.
// The suggestions open above the box when there is no room below, where the page header covers them,
// so the box is scrolled to the top first.
async function searchLocation(page, text) {
  const box = textBox(page, 'Location');
  await box.evaluate(input => input.scrollIntoView({ block: 'start' }));
  await Promise.all([
    page.waitForResponse(res => res.url().includes('/api/geo/places?')
      && new URL(res.url()).searchParams.get('q') === text),
    box.fill(text),
  ]);
  return field(page, 'Location').locator('li > button');
}

// ---------------------------------------------------------------- Lists (Company size, Timezone, Language, Currency)

// Opens the Company size dropdown and returns its options
async function companySizeOptions(page) {
  await field(page, 'Company size').getByRole('combobox').click();
  const options = await page.getByRole('option').allInnerTexts();
  await page.keyboard.press('Escape');
  return options;
}

async function chooseCompanySize(page, option) {
  await field(page, 'Company size').getByRole('combobox').click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

// Opens the Timezone, Language or Currency list and returns its search box.
// The list closes when the page scrolls, so the button is scrolled into view first and the click retried.
async function openPicker(page, label) {
  const button = pickerButton(page, label);
  const search = page.getByPlaceholder(SEARCH[label]);
  await expect(async () => {
    await button.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    if (!await search.isVisible()) await button.click();
    await expect(search).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20000 });
  return search;
}

/**
 * Searches the open list and returns it with its rows.
 * The list is shown on top of the page, outside the form.
 * @returns {Promise<{ list: import('@playwright/test').Locator, rows: import('@playwright/test').Locator }>}
 */
async function searchPicker(page, label, text) {
  const search = await openPicker(page, label);
  await search.fill(text);
  const list = page.locator('body > div').filter({ has: search });
  return { list, rows: list.locator('li > button') };
}

// Searches a list and picks the row containing `row`, e.g. pickFromList(page, 'Timezone', 'Tokyo', 'Asia/Tokyo')
async function pickFromList(page, label, text, row) {
  const { rows } = await searchPicker(page, label, text);
  await rows.filter({ hasText: row }).first().click();
}

module.exports = {
  FIELDS, KEYS, readCompany, restoreCompany, openCompanySettings, reloadCompanySettings, field, fieldLabels,
  textBox, pickerButton, saveChanges, expectSaved, expectRefused, searchLocation, companySizeOptions,
  chooseCompanySize, searchPicker, pickFromList,
};
