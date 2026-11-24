// tests/common/profileSettings.js
// Helpers for the Profile settings tests in tests/Profile/.
// Settings > Profile > Account tab: Profile picture, Full name, Email (read only), Phone number, Location,
// Timezone, Language and Default currency, then "Save Changes" (disabled until something changes).
// Every save changes the profile of the test account that all tests log in with, so a test reads the profile
// when it opens the page (openProfileSettings) and puts it back at the end (restoreProfile).
const { expect } = require('@playwright/test');
const { loginStaging } = require('./createDeal');
const { field, textBox, pickerButton } = require('./companySettings');

const BASE_URL = 'https://staging.pipeclose.com';
const UPDATE_URL = /\/api\/profile\/update$/;
const SAVED_MESSAGE = 'Profile updated successfully';

// The Account tab fields, in the order the form shows them
const FIELDS = ['Profile picture', 'Full name', 'Email', 'Phone number', 'Location', 'Timezone', 'Language',
  'Default currency'];

// Where each text field is stored in the profile
const KEYS = { 'Full name': 'name', Location: 'address' };

// ---------------------------------------------------------------- Profile record

// The profile as saved on the server
async function readProfile(page) {
  const response = await page.request.get(`${BASE_URL}/api/profile/user`);
  expect(response.ok(), `Reading the profile returned ${response.status()}`).toBeTruthy();
  return (await response.json()).data;
}

const pictureUrl = profile => profile.profileImg?.[0]?.url ?? null;

// Downloads the current picture, so restoreProfile can upload it again after a test changes or removes it
async function rememberPicture(page, profile) {
  const picture = profile.profileImg?.[0];
  if (!picture) return;
  const response = await page.request.get(picture.url);
  expect(response.ok(), `Downloading the profile picture returned ${response.status()}`).toBeTruthy();
  profile.pictureFile = { name: picture.originalName, mimeType: picture.mimetype, buffer: await response.body() };
}

// Saves the profile back as it was read, with the same fields the form sends.
// The picture is put back only when it changed and was downloaded first (rememberPicture).
async function restoreProfile(page, profile) {
  const current = await readProfile(page);
  const keys = ['name', 'phone', 'phoneCountryCode', 'address', 'timezone', 'language', 'defaultCurrency'];
  const fieldsChanged = keys.some(key => current[key] !== profile[key]);
  const pictureChanged = pictureUrl(current) !== pictureUrl(profile);
  if (!fieldsChanged && !pictureChanged) return;

  const multipart = {
    name: profile.name,
    phone: profile.phone ?? '',
    phoneCountryCode: profile.phoneCountryCode ?? '',
    location: profile.address ?? '',
    timezone: profile.timezone,
    language: profile.language,
    defaultCurrency: profile.defaultCurrency,
  };
  if (pictureChanged && profile.pictureFile) multipart.profileImg = profile.pictureFile;
  const response = await page.request.put(`${BASE_URL}/api/profile/update`, { multipart });
  expect(response.ok(), `Restoring the profile returned ${response.status()}`).toBeTruthy();
  if (pictureChanged && !profile.pictureFile) console.log('The profile picture changed and was not downloaded first, so it was not restored');
  console.log('Profile restored');
}

// ---------------------------------------------------------------- Page

// Logs in once and saves the login to `path`, so each test can start logged in (test.use({ storageState })).
// Staging refuses logins for a while ("Too many requests", 429) when there are many in a short time,
// so a file of tests should not log in once per test.
async function saveLogin(browser, path) {
  // Empty: contexts made in hooks also get test.use options, and the saved login does not exist yet
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await loginStaging(page);
  await expect(page, 'Login should open the Deals page').toHaveURL(/\/deals/, { timeout: 60000 });
  await context.storageState({ path });
  await context.close();
}

// Opens the Deals page, logging in first if the saved login is missing or has expired,
// then opens Settings from the sidebar (it opens on Profile). Returns the saved profile.
async function openProfileSettings(page) {
  const expand = page.getByRole('button', { name: 'Expand sidebar' });
  const sidebar = expand.or(page.getByRole('button', { name: 'Collapse sidebar' }));
  const loggedOut = page.getByPlaceholder('Email').or(page.getByRole('link', { name: /^Log in/ }));

  await page.goto(`${BASE_URL}/deals`, { waitUntil: 'domcontentloaded' });
  await sidebar.or(loggedOut).first().waitFor({ timeout: 60000 });
  if (await loggedOut.first().isVisible()) {
    await loginStaging(page);
    await expect(page).toHaveURL(/\/deals/, { timeout: 60000 });
  }

  // The sidebar starts collapsed, and collapsed it does not show the Settings link
  await sidebar.first().waitFor({ timeout: 30000 });
  if (await expand.isVisible()) await expand.click();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();

  return waitForProfileForm(page);
}

// Waits for the Profile page to show the saved profile, and returns it. Staging can take a while to draw
// the page after the address changes, so the waits are long.
async function waitForProfileForm(page) {
  await expect(page).toHaveURL(/\/settings\/profile/, { timeout: 30000 });
  await expect(page.getByRole('heading', { name: 'Profile', level: 1 })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: 'Account', exact: true })).toBeVisible({ timeout: 30000 });
  const profile = await readProfile(page);
  await expect(textBox(page, 'Full name'), 'The form should show the saved name')
    .toHaveValue(profile.name, { timeout: 30000 });
  return profile;
}

// Reloads the page and waits for the form to show the saved profile. Returns the profile.
async function reloadProfileSettings(page) {
  await page.reload();
  return waitForProfileForm(page);
}

// The labels of the Account tab, in order
async function fieldLabels(page) {
  return page.locator('label', { hasText: /^Full name$/ }).locator('xpath=ancestor::section[1]').locator('label')
    .allInnerTexts();
}

const saveButton = page => page.getByRole('button', { name: 'Save Changes' });

// Clicks Save Changes, waits for the update and the success message, and returns the saved profile
async function saveChanges(page) {
  const [response] = await Promise.all([
    page.waitForResponse(res => UPDATE_URL.test(res.url()) && res.request().method() === 'PUT'),
    saveButton(page).click(),
  ]);
  expect(response.ok(), `Save returned ${response.status()}`).toBeTruthy();
  await expect(page.getByText(SAVED_MESSAGE), 'Success message should show').toBeVisible();
  return (await response.json()).data;
}

// The user menu button in the header (picture and name), next to Notifications
const headerName = page => page.getByRole('button', { name: 'Notifications' }).locator('xpath=following::button[1]');

// ---------------------------------------------------------------- Text fields

// A value as the log and error messages show it: quoted, long values cut
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

  await reloadProfileSettings(page);
  await expect.soft(textBox(page, label), `${what} should still show after a reload`).toHaveValue(stored);
  console.log(`${what}: saved as ${quote(saved[KEYS[label]] ?? '(missing)')}`);
}

// Error messages on the page: the message boxes at the top right
async function errorMessages(page) {
  const toasts = await page.locator('#root > div.fixed.top-4').allInnerTexts();
  return toasts.join(' ').replace(SAVED_MESSAGE, '').replace(/\s+/g, ' ').trim();
}

/**
 * Types an invalid value into a box, clicks Save and checks it is refused: the stored profile does not change
 * and an error message is shown (a message box, or the browser's own message), or Save stays disabled.
 * If it is saved anyway, the profile is restored so the next check starts from the original value.
 * Soft assertion, so every invalid value in a test is checked and reported.
 * @param {object} profile the profile read when the page was opened
 * @param {import('@playwright/test').Locator} box the input to type in
 * @param {string} key where the value is stored in the profile, e.g. 'name'
 */
async function expectRefused(page, profile, what, box, key, invalid) {
  what = `${what} ${quote(invalid)}`;
  await reloadProfileSettings(page);

  await box.fill(invalid);
  const update = page.waitForResponse(res => UPDATE_URL.test(res.url()) && res.request().method() === 'PUT',
    { timeout: 5000 }).catch(() => null);
  const enabled = await saveButton(page).isEnabled();
  if (enabled) await saveButton(page).click();
  const sent = await update;
  const error = [await errorMessages(page), await box.evaluate(input => input.validationMessage)]
    .filter(Boolean).join(' ');

  const stored = (await readProfile(page))[key];
  const changed = stored !== profile[key];
  const problems = [];
  if (changed) problems.push(`saved - the profile now has ${quote(String(stored))}`);
  else if (enabled && !error) problems.push(`not saved, but no error message was shown${sent ? '' : ' (nothing was sent)'}`);
  expect.soft(problems, `${what} should be refused`).toEqual([]);
  console.log(`${what}: ${problems.length ? `NOT VALIDATED - ${problems.join('; ')}`
    : `refused - ${enabled ? `"${error}"` : 'Save stays disabled'}`}`);

  if (changed) await restoreProfile(page, profile);
}

// ---------------------------------------------------------------- Phone number

const phoneBox = page => field(page, 'Phone number').locator('input[type="tel"]');
const countryButton = page => field(page, 'Phone number').getByRole('button').first();

// Opens the country list, searches it and picks the country, e.g. chooseCountry(page, 'United States', 'US')
// The list does not close on Escape, so it is opened only when it is not open already.
async function chooseCountry(page, search, code) {
  const searchBox = page.getByPlaceholder(/^Search country or dial code/);
  if (!await searchBox.isVisible()) await countryButton(page).click();
  await searchBox.fill(search);
  await page.getByRole('button', { name: new RegExp(`^${code} ${search}`) }).first().click();
  await expect(countryButton(page).getByRole('img', { name: code })).toBeVisible();
}

// ---------------------------------------------------------------- Profile picture

const pictureInput = page => page.locator('input[type="file"]');
const cropDialog = page => page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Crop your picture' }) });

// A PNG drawn in the browser: a coloured square with "QA" on it
async function makePicture(page, size = 300) {
  const dataUrl = await page.evaluate(side => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = side;
    const context = canvas.getContext('2d');
    context.fillStyle = '#7c3aed';
    context.fillRect(0, 0, side, side);
    context.fillStyle = '#ffffff';
    context.font = `bold ${side / 3}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('QA', side / 2, side / 2);
    return canvas.toDataURL('image/png');
  }, size);
  return { name: 'qa-avatar.png', mimeType: 'image/png', buffer: Buffer.from(dataUrl.split(',')[1], 'base64') };
}

module.exports = {
  FIELDS, KEYS, SAVED_MESSAGE, readProfile, pictureUrl, rememberPicture, restoreProfile, saveLogin, openProfileSettings,
  reloadProfileSettings, fieldLabels, saveButton, saveChanges, headerName, expectSaved, expectRefused,
  errorMessages, phoneBox, countryButton, chooseCountry, pictureInput, cropDialog, makePicture,
  field, textBox, pickerButton,
};
