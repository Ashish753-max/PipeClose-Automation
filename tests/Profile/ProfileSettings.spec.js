// Settings > Profile > Account tab
// After login: open Settings from the sidebar (it opens on Profile) and check every field with
//   - valid values: saved, and still shown after a reload
//   - invalid values: refused - not saved, and an error message is shown
// The profile is the test account's own, which every test logs in with. Tests run one at a time in this order,
// and each one puts the profile back as it was (afterEach). Valid names all start with "Ashish", so tests
// running at the same time that find the user menu by the name "Ashish" still find it.
// Tests calling knownDefect() check a defect found on staging: see knownDefect in tests/common/authPages.js.
// Screenshots: screenshots/Profile/Profile-*.png
const { test, expect } = require('@playwright/test');
const { knownDefect } = require('../common/authPages');
const { searchLocation, searchPicker, pickFromList } = require('../common/companySettings');
const {
  FIELDS, readProfile, pictureUrl, rememberPicture, restoreProfile, saveLogin, openProfileSettings, reloadProfileSettings,
  fieldLabels, saveButton, saveChanges, headerName, expectSaved, expectRefused, phoneBox,
  countryButton, chooseCountry, pictureInput, cropDialog, makePicture, field, textBox, pickerButton,
} = require('../common/profileSettings');

test.describe.configure({ mode: 'default' });

// Log in once for the whole file: staging refuses logins for a while when there are too many
const LOGIN_FILE = 'test-results/.auth/profile-settings.json';
test.beforeAll(async ({ browser }) => saveLogin(browser, LOGIN_FILE));
test.use({ storageState: LOGIN_FILE });

// The profile as it was before the test, put back after it
let original = null;
test.afterEach(async ({ page }) => {
  if (original) await restoreProfile(page, original);
  original = null;
});

const nameBox = page => textBox(page, 'Full name');

test('Opens Profile from the Settings menu and shows the saved values', async ({ page }) => {
  original = await openProfileSettings(page);

  expect(await fieldLabels(page), 'The Account tab should show these fields').toEqual(FIELDS);
  await expect(nameBox(page)).toHaveValue(original.name);
  await expect(textBox(page, 'Location')).toHaveValue(original.address);
  await expect(phoneBox(page), 'The phone number should show without its country code')
    .toHaveValue(/\d/);
  expect(original.phone.replace(/\D/g, ''), 'The phone number shown should be the saved one')
    .toContain((await phoneBox(page).inputValue()).replace(/\D/g, ''));
  await expect(countryButton(page).getByRole('img', { name: original.phoneCountryCode })).toBeVisible();
  await expect(headerName(page), 'The header should show the saved name').toContainText(original.name);

  // Email is the login email and cannot be changed here
  const email = page.getByRole('textbox', { name: 'Email' });
  await expect(email).toHaveValue(original.email);
  await expect(email).toBeDisabled();
  await expect(page.getByText("This is your login email. It can't be changed here yet.")).toBeVisible();

  // Save is enabled only once something changes
  await expect(saveButton(page), 'Save should be disabled until something changes').toBeDisabled();
  await nameBox(page).fill(`${original.name} QA`);
  await expect(saveButton(page)).toBeEnabled();
  await nameBox(page).fill(original.name);
  await expect(saveButton(page), 'Save should be disabled again when the change is undone').toBeDisabled();
  await page.screenshot({ path: 'screenshots/Profile/Profile-1-opened.png', fullPage: true });
});

test('Edits that are not saved are discarded on reload', async ({ page }) => {
  original = await openProfileSettings(page);

  await nameBox(page).fill('Ashish Not Saved');
  await phoneBox(page).fill('9123456789');
  await reloadProfileSettings(page);

  await expect(nameBox(page)).toHaveValue(original.name);
  const stored = await readProfile(page);
  expect(stored.name).toBe(original.name);
  expect(stored.phone).toBe(original.phone);
});

test.describe('Full name', () => {
  test('valid names are saved and shown in the header', async ({ page }) => {
    test.setTimeout(300000);
    original = await openProfileSettings(page);

    await expectSaved(page, 'Full name', 'Ashish Rai QA');
    await expect(headerName(page), 'The header should show the new name').toContainText('Ashish Rai QA');
    await page.screenshot({ path: 'screenshots/Profile/Profile-2-name-saved.png' });
    await expectSaved(page, 'Full name', "Ashish O'Neil-Rai");
    await expectSaved(page, 'Full name', 'Ashish Rái Ñúñez');
    // Spaces around the name are trimmed
    await expectSaved(page, 'Full name', '  Ashish Trimmed  ', 'Ashish Trimmed');
  });

  test('text that looks like HTML is saved and shown as plain text', async ({ page }) => {
    original = await openProfileSettings(page);
    let dialogs = 0;
    page.on('dialog', dialog => { dialogs++; dialog.dismiss(); });

    const name = 'Ashish <b>Bold</b><img src=x onerror=alert(1)>';
    await expectSaved(page, 'Full name', name);
    await expect(headerName(page), 'The header should show the name as typed').toContainText(name);
    expect(dialogs, 'The name should not run as code').toBe(0);
  });

  test('empty and blank names are refused', async ({ page }) => {
    knownDefect('An empty or blank Full name is saved: the profile is left with no name');
    test.setTimeout(180000);
    original = await openProfileSettings(page);
    for (const invalid of ['', '   ']) {
      await expectRefused(page, original, 'Full name', nameBox(page), 'name', invalid);
    }
  });

  test('a name with no letters is refused', async ({ page }) => {
    knownDefect('A Full name of only digits ("12345") is saved');
    original = await openProfileSettings(page);
    await expectRefused(page, original, 'Full name', nameBox(page), 'name', '12345');
  });

  test('a 300-character name is refused', async ({ page }) => {
    knownDefect('Full name has no length limit: a 300-character name is saved and stretches the header');
    original = await openProfileSettings(page);
    await expectRefused(page, original, 'Full name', nameBox(page), 'name', `Ashish ${'A'.repeat(293)}`);
  });
});

test.describe('Phone number', () => {
  test('a valid number is saved with its country code and shown formatted', async ({ page }) => {
    original = await openProfileSettings(page);

    await chooseCountry(page, 'India', 'IN');
    await phoneBox(page).fill('9876543210');
    const saved = await saveChanges(page);
    expect(saved.phone).toBe('+919876543210');
    expect(saved.phoneCountryCode).toBe('IN');

    await reloadProfileSettings(page);
    await expect(phoneBox(page), 'The number should show formatted after a reload').toHaveValue('98765 43210');
    await page.screenshot({ path: 'screenshots/Profile/Profile-3-phone-saved.png' });
  });

  test('another country code is saved with the number', async ({ page }) => {
    original = await openProfileSettings(page);

    // The country list can be searched by name or dial code
    await countryButton(page).click();
    await page.getByPlaceholder(/^Search country or dial code/).fill('+44');
    await expect(page.getByRole('button', { name: /^GB United Kingdom \+44$/ })).toBeVisible();
    await page.keyboard.press('Escape');

    await chooseCountry(page, 'United States', 'US');
    await phoneBox(page).fill('2015550123');
    const saved = await saveChanges(page);
    expect(saved.phone).toBe('+12015550123');
    expect(saved.phoneCountryCode).toBe('US');

    await reloadProfileSettings(page);
    await expect(countryButton(page).getByRole('img', { name: 'US' }), 'US should stay chosen after a reload')
      .toBeVisible();
    await expect(countryButton(page)).toContainText('+1');
    expect((await phoneBox(page).inputValue()).replace(/\D/g, '')).toBe('2015550123');
  });

  test('letters cannot be typed, and typing stops at the longest valid number', async ({ page }) => {
    original = await openProfileSettings(page);
    await chooseCountry(page, 'India', 'IN');

    await phoneBox(page).fill('');
    await phoneBox(page).pressSequentially('abcxyz');
    await expect(phoneBox(page), 'Letters should not be typed').toHaveValue('');

    await phoneBox(page).pressSequentially('98765432109876');
    const digits = (await phoneBox(page).inputValue()).replace(/\D/g, '');
    expect(digits, 'An Indian number should stop at 10 digits').toBe('9876543210');
  });

  test('empty and too-short numbers are refused with "Invalid phone number"', async ({ page }) => {
    test.setTimeout(180000);
    original = await openProfileSettings(page);
    for (const invalid of ['', '123']) {
      await reloadProfileSettings(page);
      const sent = [];
      page.on('request', request => { if (request.url().includes('/api/profile/update')) sent.push(request.url()); });
      await phoneBox(page).fill(invalid);
      await saveButton(page).click();

      await expect(page.getByText('Invalid phone number'), `"${invalid}" should show an error`).toBeVisible();
      await expect(page.getByText('Please enter a valid phone number')).toBeVisible();
      expect(sent, `"${invalid}" should not be sent`).toEqual([]);
      expect((await readProfile(page)).phone).toBe(original.phone);
      if (invalid === '123') await page.screenshot({ path: 'screenshots/Profile/Profile-4-phone-invalid.png' });
      page.removeAllListeners('request');
    }
  });

  test('a number of all zeros is refused', async ({ page }) => {
    knownDefect('Phone number "0000000000" is saved as +910000000000');
    original = await openProfileSettings(page);
    await chooseCountry(page, 'India', 'IN');
    await expectRefused(page, original, 'Phone number', phoneBox(page), 'phone', '0000000000');
  });
});

test.describe('Location', () => {
  test('a searched place is picked, saved and can be cleared', async ({ page }) => {
    original = await openProfileSettings(page);

    let rows = await searchLocation(page, 'zzqqxxyy');
    await expect(rows, 'A search with no match should list no places').toHaveCount(0);
    rows = await searchLocation(page, 'Mumbai');
    await expect(rows.first()).toBeVisible();

    const place = 'Mumbai, Maharashtra, India';
    await rows.filter({ has: page.getByText(place, { exact: true }) }).click();
    await expect(textBox(page, 'Location')).toHaveValue(place);
    const saved = await saveChanges(page);
    expect(saved.address).toBe(place);
    await reloadProfileSettings(page);
    await expect(textBox(page, 'Location')).toHaveValue(place);
    await page.screenshot({ path: 'screenshots/Profile/Profile-5-location.png' });

    // The X button empties the box
    await field(page, 'Location').getByRole('button').click();
    await expect(textBox(page, 'Location')).toHaveValue('');
  });

  test('empty location is refused (the field is required)', async ({ page }) => {
    knownDefect('Location is marked required, but an empty Location is saved');
    original = await openProfileSettings(page);
    await expect(textBox(page, 'Location')).toHaveAttribute('required', '');
    await expectRefused(page, original, 'Location', textBox(page, 'Location'), 'address', '');
  });
});

test('Timezone: search, pick and save', async ({ page }) => {
  original = await openProfileSettings(page);

  const { list, rows } = await searchPicker(page, 'Timezone', '@@##$$');
  await expect(rows, 'A search with no match should list no timezones').toHaveCount(0);
  await expect(list).toContainText('Nothing found');
  await page.keyboard.press('Escape');

  await pickFromList(page, 'Timezone', 'Tokyo', 'Asia/Tokyo');
  await expect(pickerButton(page, 'Timezone')).toContainText('Japan Standard Time');
  const saved = await saveChanges(page);
  expect(saved.timezone).toBe('Asia/Tokyo');
  await reloadProfileSettings(page);
  await expect(pickerButton(page, 'Timezone'), 'Timezone should stay after a reload').toContainText('Japan Standard Time');
});

test('Language: search, pick and save', async ({ page }) => {
  original = await openProfileSettings(page);

  const { list, rows } = await searchPicker(page, 'Language', 'zzqq');
  await expect(rows, 'A search with no match should list no languages').toHaveCount(0);
  await expect(list).toContainText('Nothing found');
  await page.keyboard.press('Escape');

  await pickFromList(page, 'Language', 'Hindi', /^Hindi$/);
  await expect(pickerButton(page, 'Language')).toHaveText('Hindi');
  const saved = await saveChanges(page);
  expect(saved.language).toBe('hi');
  await reloadProfileSettings(page);
  await expect(pickerButton(page, 'Language'), 'Language should stay after a reload').toHaveText('Hindi');
});

test('Default currency: search, pick and save', async ({ page }) => {
  original = await openProfileSettings(page);

  const { list, rows } = await searchPicker(page, 'Default currency', 'zzqq');
  await expect(rows, 'A search with no match should list no currencies').toHaveCount(0);
  await expect(list).toContainText('Nothing found');
  await page.keyboard.press('Escape');

  await pickFromList(page, 'Default currency', 'EUR', 'EUR – Euro');
  await expect(pickerButton(page, 'Default currency')).toContainText('EUR – Euro');
  const saved = await saveChanges(page);
  expect(saved.defaultCurrency).toBe('EUR');
  await reloadProfileSettings(page);
  await expect(pickerButton(page, 'Default currency'), 'Currency should stay after a reload').toContainText('EUR – Euro');
  await page.screenshot({ path: 'screenshots/Profile/Profile-6-lists.png', fullPage: true });
});

test.describe('Profile picture', () => {
  test('files that are not JPG, GIF or PNG, or are over 10 MB, are refused', async ({ page }) => {
    original = await openProfileSettings(page);
    await expect(page.getByText('Max size 10 MB. Formats: JPG, GIF, PNG.')).toBeVisible();

    await pictureInput(page).setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
    await expect(page.getByText('Choose a JPG, GIF or PNG image.')).toBeVisible();
    await expect(cropDialog(page)).toBeHidden();
    await expect(saveButton(page)).toBeDisabled();

    // 11 MB, starting like a real PNG so only its size is wrong
    const big = Buffer.alloc(11 * 1024 * 1024);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(big);
    await pictureInput(page).setInputFiles({ name: 'big.png', mimeType: 'image/png', buffer: big });
    await expect(page.getByText('This image is 11.0 MB. The maximum is 10 MB.')).toBeVisible();
    await expect(cropDialog(page)).toBeHidden();
    await expect(saveButton(page)).toBeDisabled();
    await page.screenshot({ path: 'screenshots/Profile/Profile-7-picture-too-big.png' });

    expect(pictureUrl(await readProfile(page)), 'The picture should not change').toBe(pictureUrl(original));
  });

  test('Cancel in the crop window keeps the current picture', async ({ page }) => {
    original = await openProfileSettings(page);

    await pictureInput(page).setInputFiles(await makePicture(page));
    await expect(cropDialog(page)).toBeVisible();
    await expect(cropDialog(page).getByRole('slider', { name: 'Zoom' })).toBeVisible();
    await cropDialog(page).getByRole('button', { name: 'Cancel' }).click();

    await expect(cropDialog(page)).toBeHidden();
    await expect(saveButton(page), 'Nothing should have changed').toBeDisabled();
    expect(pictureUrl(await readProfile(page))).toBe(pictureUrl(original));
  });

  test('a new picture is cropped, saved, shown, and can be removed', async ({ page }) => {
    original = await openProfileSettings(page);
    await rememberPicture(page, original);
    const avatar = page.getByRole('img', { name: 'Profile', exact: true });

    // Choose, crop and save
    await pictureInput(page).setInputFiles(await makePicture(page));
    await expect(cropDialog(page)).toBeVisible();
    await page.screenshot({ path: 'screenshots/Profile/Profile-8-picture-crop.png' });
    await cropDialog(page).getByRole('button', { name: 'Apply' }).click();
    await expect(cropDialog(page)).toBeHidden();
    const saved = await saveChanges(page);
    const newUrl = pictureUrl(saved);
    expect(newUrl, 'A new picture should be saved').toBeTruthy();
    expect(newUrl).not.toBe(pictureUrl(original));

    await reloadProfileSettings(page);
    await expect(avatar, 'The new picture should show after a reload').toHaveAttribute('src', newUrl);
    await expect(headerName(page).getByRole('img'), 'The header should show the new picture').toHaveAttribute('src', newUrl);
    await page.screenshot({ path: 'screenshots/Profile/Profile-9-picture-saved.png' });

    // Remove it: the uploaded picture is replaced by the initials, and Remove is gone
    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(avatar, 'Remove should take the picture off the form').not.toHaveAttribute('src', newUrl);
    const removed = await saveChanges(page);
    expect(removed.profileImg ?? [], 'The picture should be removed').toEqual([]);
    await reloadProfileSettings(page);
    await expect(field(page, 'Profile picture').locator(`img[src="${newUrl}"]`), 'The removed picture should not show')
      .toHaveCount(0);
    await expect(headerName(page).locator(`img[src="${newUrl}"]`), 'The header should not show the removed picture')
      .toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Remove', exact: true })).toBeHidden();
    await page.screenshot({ path: 'screenshots/Profile/Profile-10-picture-removed.png' });
  });
});

test('Opens Profile from the user menu', async ({ page }) => {
  original = await openProfileSettings(page);
  await page.goto('https://staging.pipeclose.com/deals');
  await headerName(page).click();
  await page.getByRole('button', { name: 'View Profile' }).or(page.getByRole('menuitem', { name: /profile/i })).first().click();
  await expect(page).toHaveURL(/\/settings\/profile/);
  await expect(page.getByRole('heading', { name: 'Profile', level: 1 })).toBeVisible();
  await expect(nameBox(page)).toHaveValue(original.name);
});
