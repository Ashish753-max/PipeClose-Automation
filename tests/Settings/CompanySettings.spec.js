// Settings > Company settings > Company Details
// After login: open Settings from the sidebar, then Company settings, and check every field with
//   - valid values: saved, and still shown after a reload
//   - invalid values: refused - not saved, and an error message is shown
//   - edge cases: shortest/longest values, special characters, optional fields left empty, searches with no match
// All tests change the same company record, so they run one at a time in this order,
// and each one puts the record back as it was (afterEach).
// Screenshots: screenshots/Settings/Company-*.png
const { test, expect } = require('@playwright/test');
const {
  FIELDS, readCompany, restoreCompany, openCompanySettings, reloadCompanySettings, field, fieldLabels, textBox,
  pickerButton, saveChanges, expectSaved, expectRefused, searchLocation, companySizeOptions, chooseCompanySize,
  searchPicker, pickFromList,
} = require('../common/companySettings');

test.describe.configure({ mode: 'default' });

const COMPANY_SIZES = [
  '1 – 10 (Solo / micro team)',
  '11 – 50 (Small team)',
  '51 – 200 (Growing company)',
  '201 – 500 (Mid-size)',
  '501 – 1,000 (Large)',
  '1,000+ (Enterprise)',
];

// The company as it was before the test, put back after it
let original = null;
test.afterEach(async ({ page }) => {
  if (original) await restoreCompany(page, original);
  original = null;
});

test('Opens Company settings from the Settings menu and shows the saved values', async ({ page }) => {
  original = await openCompanySettings(page);

  expect(await fieldLabels(page), 'Company Details should show these fields').toEqual(FIELDS);
  await expect(textBox(page, 'Company name')).toHaveValue(original.name);
  await expect(textBox(page, 'Company domain')).toHaveValue(original.companyDomain);
  await expect(textBox(page, 'Location')).toHaveValue(original.companyLocation);
  await expect(textBox(page, 'Website')).toHaveValue(original.companyWebsite);
  await expect(pickerButton(page, 'Currency')).toContainText(original.currency);
  await page.screenshot({ path: 'screenshots/Settings/Company-1-opened.png', fullPage: true });

  // Saving without changes keeps every value
  const saved = await saveChanges(page);
  for (const key of ['name', 'companyDomain', 'companySize', 'companyLocation', 'companyWebsite', 'locale', 'currency']) {
    expect.soft(saved[key], `Saving without changes should keep ${key}`).toBe(original[key]);
  }
});

test('Edits that are not saved are discarded on reload', async ({ page }) => {
  original = await openCompanySettings(page);

  await textBox(page, 'Company name').fill('Not saved name');
  await textBox(page, 'Website').fill('https://not-saved.com');
  await reloadCompanySettings(page);

  await expect(textBox(page, 'Company name')).toHaveValue(original.name);
  await expect(textBox(page, 'Website')).toHaveValue(original.companyWebsite);
  const stored = await readCompany(page);
  expect(stored.name).toBe(original.name);
  expect(stored.companyWebsite).toBe(original.companyWebsite);
});

test.describe('Company name', () => {
  test('valid names are saved', async ({ page }) => {
    test.setTimeout(300000);
    original = await openCompanySettings(page);

    // A script in the name must stay plain text, never run
    const dialogs = [];
    page.on('dialog', dialog => { dialogs.push(dialog.message()); dialog.dismiss(); });

    await expectSaved(page, 'Company name', 'Pipeclose QA');
    await expectSaved(page, 'Company name', 'A');
    await expectSaved(page, 'Company name', 'Pipeclosé & Co. (India) Pvt-Ltd #1');
    await expectSaved(page, 'Company name', 'N'.repeat(255));
    await expectSaved(page, 'Company name', '<script>alert(1)</script>');
    expect(dialogs, 'No script from the name should run').toEqual([]);
    await page.screenshot({ path: 'screenshots/Settings/Company-2-name-saved.png' });
  });

  test('empty and blank names are refused, spaces around a name are trimmed', async ({ page }) => {
    original = await openCompanySettings(page);
    for (const invalid of ['', '     ']) {
      await expectRefused(page, original, 'Company name', invalid);
    }
    await expectSaved(page, 'Company name', '  Pipeclose Trim  ', 'Pipeclose Trim');
  });
});

test.describe('Company domain', () => {
  test('valid domains are saved', async ({ page }) => {
    original = await openCompanySettings(page);
    await expectSaved(page, 'Company domain', 'pipeclose-qa');
    await expectSaved(page, 'Company domain', 'pipeclose2');
  });

  test('empty, blank and malformed domains are refused', async ({ page }) => {
    test.setTimeout(300000);
    original = await openCompanySettings(page);
    for (const invalid of ['', '     ', 'pipe close', 'pipe@close!', '<script>']) {
      await expectRefused(page, original, 'Company domain', invalid);
    }
  });
});

test('Company size: offers every size and saves each one', async ({ page }) => {
  test.setTimeout(300000);
  original = await openCompanySettings(page);
  expect(await companySizeOptions(page)).toEqual(COMPANY_SIZES);

  const savedValues = [];
  for (const size of COMPANY_SIZES) {
    await chooseCompanySize(page, size);
    const saved = await saveChanges(page);
    savedValues.push(saved.companySize);
    await reloadCompanySettings(page);
    await expect.soft(field(page, 'Company size').getByRole('combobox'), `"${size}" should stay after a reload`)
      .toHaveText(size);
    console.log(`Company size "${size}": saved as "${saved.companySize}"`);
  }
  expect(new Set(savedValues).size, `Each size should be saved as its own value: ${savedValues}`)
    .toBe(COMPANY_SIZES.length);
});

test.describe('Location', () => {
  test('a searched place is picked, saved and can be cleared', async ({ page }) => {
    original = await openCompanySettings(page);

    // Search lists matching places; a search that matches nothing lists none
    let rows = await searchLocation(page, 'zzqqxxyy');
    await expect(rows, 'A search with no match should list no places').toHaveCount(0);
    rows = await searchLocation(page, 'Mumbai');
    await expect(rows.first()).toBeVisible();
    await expect(field(page, 'Location').getByText(/\d+ locations? found/)).toBeVisible();
    await page.screenshot({ path: 'screenshots/Settings/Company-3-location-search.png' });

    // Pick a place and save it
    const place = 'Mumbai, Maharashtra, India';
    await rows.filter({ has: page.getByText(place, { exact: true }) }).click();
    await expect(textBox(page, 'Location')).toHaveValue(place);
    const saved = await saveChanges(page);
    expect(saved.companyLocation).toBe(place);
    await reloadCompanySettings(page);
    await expect(textBox(page, 'Location')).toHaveValue(place);

    // The X button empties the box
    await field(page, 'Location').getByRole('button').click();
    await expect(textBox(page, 'Location')).toHaveValue('');
  });

  test('empty location is refused (the field is required)', async ({ page }) => {
    original = await openCompanySettings(page);
    await expect(textBox(page, 'Location')).toHaveAttribute('required', '');
    await expectRefused(page, original, 'Location', '');
  });
});

test.describe('Website', () => {
  test('valid websites are saved', async ({ page }) => {
    test.setTimeout(300000);
    original = await openCompanySettings(page);
    await expectSaved(page, 'Website', 'https://pipeclose.com');
    await expectSaved(page, 'Website', 'http://www.pipeclose.com');
    await expectSaved(page, 'Website', 'https://sub.pipeclose.co.in/path?ref=qa');
    // Without http(s):// the app adds https://
    await expectSaved(page, 'Website', 'pipeclose.com', 'https://pipeclose.com');
    // Website is optional
    await expectSaved(page, 'Website', '');
  });

  test('invalid websites are refused', async ({ page }) => {
    test.setTimeout(300000);
    original = await openCompanySettings(page);
    for (const invalid of ['not a url', 'pipeclose', 'https://', 'https://pipe close.com', 'javascript:alert(1)']) {
      await expectRefused(page, original, 'Website', invalid);
    }
  });
});

test('Timezone: search by city or abbreviation, pick and save', async ({ page }) => {
  original = await openCompanySettings(page);

  let { list, rows } = await searchPicker(page, 'Timezone', 'IST');
  await expect(rows.first(), 'Searching "IST" should list India first').toContainText('Asia/Kolkata');
  ({ list, rows } = await searchPicker(page, 'Timezone', '@@##$$'));
  await expect(rows, 'A search with no match should list no timezones').toHaveCount(0);
  await expect(list).toContainText('Nothing found');
  await page.keyboard.press('Escape');

  await pickFromList(page, 'Timezone', 'Tokyo', 'Asia/Tokyo');
  await expect(pickerButton(page, 'Timezone')).toContainText('Japan Standard Time');
  const saved = await saveChanges(page);
  expect(saved.timezone).toBe('Asia/Tokyo');
  await reloadCompanySettings(page);
  await expect(pickerButton(page, 'Timezone'), 'Timezone should stay after a reload').toContainText('Japan Standard Time');
  await page.screenshot({ path: 'screenshots/Settings/Company-4-timezone.png' });
});

test('Language: search, pick and save', async ({ page }) => {
  original = await openCompanySettings(page);

  let { list, rows } = await searchPicker(page, 'Language', 'hin');
  await expect(rows.filter({ hasText: /^Hindi$/ }), 'A partial search should find Hindi').toHaveCount(1);
  ({ list, rows } = await searchPicker(page, 'Language', 'zzqq'));
  await expect(rows, 'A search with no match should list no languages').toHaveCount(0);
  await expect(list).toContainText('Nothing found');
  await page.keyboard.press('Escape');

  await pickFromList(page, 'Language', 'Hindi', /^Hindi$/);
  await expect(pickerButton(page, 'Language')).toHaveText('Hindi');
  const saved = await saveChanges(page);
  expect(saved.locale).toBe('hi');
  await reloadCompanySettings(page);
  await expect(pickerButton(page, 'Language'), 'Language should stay after a reload').toHaveText('Hindi');
  await page.screenshot({ path: 'screenshots/Settings/Company-5-language.png' });
});

test('Currency: search, pick and save', async ({ page }) => {
  original = await openCompanySettings(page);

  let { list, rows } = await searchPicker(page, 'Currency', 'zzqq');
  await expect(rows, 'A search with no match should list no currencies').toHaveCount(0);
  await expect(list).toContainText('Nothing found');
  await page.keyboard.press('Escape');

  await pickFromList(page, 'Currency', 'EUR', 'EUR – Euro');
  await expect(pickerButton(page, 'Currency')).toContainText('EUR – Euro');
  const saved = await saveChanges(page);
  expect(saved.currency).toBe('EUR');
  await reloadCompanySettings(page);
  await expect(pickerButton(page, 'Currency'), 'Currency should stay after a reload').toContainText('EUR – Euro');
  await page.screenshot({ path: 'screenshots/Settings/Company-6-currency.png' });
});

test('Description: text is saved as typed', async ({ page }) => {
  test.setTimeout(300000);
  original = await openCompanySettings(page);
  await expectSaved(page, 'Description', 'We sell CRM software.\nSecond line & <b>special</b> characters: é ₹ "quotes"');
  await expectSaved(page, 'Description', 'D'.repeat(1000));
  // Description is optional
  await expectSaved(page, 'Description', '');
  await page.screenshot({ path: 'screenshots/Settings/Company-7-description.png' });
});
