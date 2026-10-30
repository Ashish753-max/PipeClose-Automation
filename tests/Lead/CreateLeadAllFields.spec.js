const { test, expect } = require('@playwright/test');
const { openLeads } = require('../common/createLead');
const { fieldRow } = require('../common/dealDetails');

// Dropdown button under a form label; its name changes to the picked value
const byLabel = (page, label) => page.locator('div.space-y-1')
  .filter({ has: page.locator(`xpath=./label[normalize-space()="${label}"]`) }).locator('button').first();

// Picks an option from a searchable dropdown (Industry, Country); the list opens outside the form
async function pickSearchable(page, button, search, option) {
  const box = page.getByPlaceholder(search);
  // A click often opens it and closes it again straight away, so retry until the search box stays open
  await button.scrollIntoViewIfNeeded();
  await expect(async () => {
    if (!(await box.isVisible())) await button.click();
    await expect(box).toBeVisible({ timeout: 1500 });
    await page.waitForTimeout(500);
    await expect(box).toBeVisible({ timeout: 100 });
  }, `${search} list should open`).toPass({ timeout: 20000 });
  await box.fill(option);
  await page.getByText(option, { exact: true }).last().click();
  await expect(button).toContainText(option);
}

// Picks an option from a plain listbox dropdown (Company size, Seniority, phone/email type)
async function pickOption(page, combobox, option) {
  await combobox.click();
  await page.getByRole('option', { name: option, exact: true }).click();
  await expect(combobox).toContainText(option);
}

test('Lead - create with every field and verify list columns and details', async ({ page }) => {
  test.setTimeout(240000);
  const stamp = Date.now().toString().slice(-6);
  const lead = {
    person: `AllFields${stamp}`,
    organization: `AllFieldsOrg${stamp}`,
    title: `All fields lead ${stamp}`,
    value: '7500',
    label: 'Hot',
    requirement: 'Needs a CRM for a 50 person sales team with email automation.',
    website: `allfields${stamp}.com`,
    industry: 'Software & Internet',
    companySize: '51-200',
    revenue: '5000000',
    country: 'India',
    seniority: 'Director',
    phone: '9876543210',
    phoneType: 'Mobile',
    email: `all.fields+${stamp}@gmail.com`,
    emailType: 'Work',
  };

  await openLeads(page);
  await page.getByRole('button', { name: 'Lead', exact: true }).click();
  const formHeading = page.getByRole('heading', { name: 'Add lead', level: 3 });
  await expect(formHeading).toBeVisible();

  // Every field except List
  await page.getByRole('textbox', { name: 'Name' }).first().fill(lead.person);
  const orgField = page.getByRole('textbox', { name: 'Name' }).nth(1);
  await orgField.click();
  await orgField.pressSequentially(lead.organization);
  await page.getByRole('textbox', { name: 'Lead title' }).fill(lead.title);
  await page.getByRole('spinbutton', { name: 'Value' }).fill(lead.value);
  await expect(page.getByRole('combobox').filter({ hasText: 'USD' })).toContainText('USD');

  await page.getByRole('combobox').filter({ hasText: 'Add labels' }).click();
  await page.getByRole('listbox').getByText(lead.label, { exact: true }).first().click();
  await page.keyboard.press('Escape');
  await expect(formHeading, 'Escape on the label list should not close the form').toBeVisible();

  await page.getByPlaceholder("Details about the lead's needs...").fill(lead.requirement);
  await page.getByPlaceholder('example.com').fill(lead.website);
  await pickSearchable(page, byLabel(page, 'Industry'), 'Search industries', lead.industry);
  await pickOption(page, byLabel(page, 'Company size (employees)'), lead.companySize);
  await page.getByRole('spinbutton', { name: 'Annual revenue (USD)' }).fill(lead.revenue);
  await pickSearchable(page, byLabel(page, 'Country'), /Search countr/i, lead.country);
  await pickOption(page, byLabel(page, 'Contact seniority'), lead.seniority);

  await page.getByPlaceholder('Phone number').fill(lead.phone);
  const phoneType = page.getByPlaceholder('Phone number').locator('xpath=following::button[@role="combobox"][1]');
  await pickOption(page, phoneType, lead.phoneType);
  await page.getByPlaceholder('Email address').fill(lead.email);
  const emailType = page.getByPlaceholder('Email address').locator('xpath=following::button[@role="combobox"][1]');
  await expect(emailType).toContainText(lead.emailType);
  await page.screenshot({ path: 'screenshots/LeadAllFields-1-form.png', fullPage: true });

  // Save and check what was sent
  const [response] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/leads/create') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Save', exact: true }).click(),
  ]);
  const request = response.request().postDataJSON();
  console.log('Create request:', JSON.stringify(request));
  expect(response.ok(), `Create lead API returned ${response.status()}`).toBeTruthy();
  const saved = (await response.json()).data.lead;
  console.log('Created lead:', JSON.stringify(saved));
  await expect(formHeading, 'Form should close after save').toBeHidden();
  const sent = JSON.stringify(request);
  for (const key of ['person', 'organization', 'title', 'requirement', 'website', 'industry', 'companySize', 'revenue', 'country', 'seniority', 'phone', 'email']) {
    expect.soft(sent, `Create request should include ${key}`).toContain(lead[key]);
  }

  // Leads list: one row, every column checked by its header
  const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: lead.person, exact: true }) });
  await expect(row, 'New lead should be listed once').toHaveCount(1);
  const headers = (await page.getByRole('columnheader').allInnerTexts()).map(h => h.trim().toUpperCase());
  const cells = await row.getByRole('cell').allInnerTexts();
  const column = name => cells[headers.indexOf(name)].trim();
  console.log('List row:', JSON.stringify(Object.fromEntries(headers.map((h, i) => [h || `#${i}`, cells[i]]))));
  expect.soft(column('CONTACT'), 'Contact column').toBe(lead.person);
  expect.soft(column('ORGANIZATION'), 'Organization column').toBe(lead.organization);
  expect.soft(column('SCORE'), 'Score column').toMatch(/Score: \d+/);
  expect.soft(column('EMAIL'), 'Email column').toBe(lead.email);
  expect.soft(column('WEBSITE'), 'Website column').toContain(lead.website);
  expect.soft(column('LOCATION'), 'Location column').toBe(lead.country);
  expect.soft(column('JOB TITLE'), 'Job title column (not in the Add lead form)').toBe('—');
  expect.soft(column('LINKEDIN'), 'LinkedIn column (not in the Add lead form)').toBe('—');
  await page.screenshot({ path: 'screenshots/LeadAllFields-2-list.png' });

  // Details page
  await expect(async () => {
    await page.getByRole('cell', { name: lead.person, exact: true }).first().click();
    await expect(page).toHaveURL(/\/leads\/\d+/, { timeout: 5000 });
  }).toPass({ timeout: 30000 });
  await expect(page.getByRole('heading', { name: lead.title, level: 1 })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('First name', { exact: true })).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(3000); // AI analysis rebuilds the panel when a lead is first opened
  const details = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  console.log('Details page text:', details.slice(0, 4000));

  const expectField = async (section, label, value) =>
    expect.soft(fieldRow(page, section, label), `${section} ${label}`).toContainText(value);
  await expectField('Person', 'First name', lead.person);
  await expectField('Person', 'Email', lead.email);
  await expectField('Person', 'Phone', lead.phone);
  await expectField('Organization', 'Website', lead.website);
  await expectField('Organization', 'Location', lead.country);
  await expectField('Organization', 'Industry', lead.industry);
  await expectField('Organization', 'Company size', lead.companySize);
  expect.soft(details, 'Value').toMatch(/\$7,500/);
  expect.soft(details, 'Organization name').toContain(lead.organization);
  expect.soft(details, 'Label').toMatch(new RegExp(lead.label, 'i'));
  await expectField('Person', 'Requirements', lead.requirement);
  await expectField('Organization', 'Annual revenue', '1 - 10M USD'); // 5,000,000 is shown as its range
  await expectField('Person', 'Seniority', lead.seniority);
  expect.soft(details, 'Phone type').toContain(lead.phoneType);
  await page.screenshot({ path: 'screenshots/LeadAllFields-3-details.png', fullPage: true });
});
