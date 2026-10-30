// tests/common/leadDetails.js
// Shared flow for the Lead Details scripts (tests/Lead Details/*.spec.js)
// The Person and Organization panels are the same component as on Deal details,
// so the field helpers (fieldRow, editField, expectRejected...) come from dealDetails.js
const { expect } = require('@playwright/test');
const { openLeads, addLead } = require('./createLead');
const { errorToast } = require('./dealDetails');

// Lead update request (Value, expected close date, title)
const LEAD_UPDATE_URL = /\/api\/leads\/update\?leadId=\d+/;

/**
 * Logs in, creates a fresh lead and opens its details page.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{ person: string, organization: string }>}
 */
async function openNewLead(page) {
  await openLeads(page);
  const { person, organization } = await addLead(page, 'LeadDetail');

  // A new lead is analysed by AI when first opened; the page then reloads the lead and rebuilds the
  // left panel, which would detach a field a test is about to edit, so wait for that to finish
  const settled = page.waitForResponse(r => /\/api\/leads\/ai\/analyze\/\d+$/.test(r.url()), { timeout: 30000 })
    .then(() => page.waitForResponse(r => r.url().includes('/api/leads/getBy?'), { timeout: 30000 }))
    .catch(() => {}); // no analysis, no rebuild

  // Open it from the Leads list
  // Retried: a click can land while the list is re-rendering (other leads being created) and do nothing
  await expect(async () => {
    await page.getByRole('cell', { name: person, exact: true }).first().click();
    await expect(page).toHaveURL(/\/leads\/\d+/, { timeout: 5000 });
  }).toPass({ timeout: 30000 });
  await expect(page.getByRole('heading', { name: `${person} - ${organization}`, level: 1 })).toBeVisible({ timeout: 30000 });
  await settled;
  await expect(page.getByText('First name', { exact: true })).toBeVisible({ timeout: 30000 });
  console.log(`Opened lead ${page.url()}`);
  return { person, organization };
}

// Summary block at the top of the left panel: value, organization, person, labels, close date
const summaryBlock = page => page.getByRole('button', { name: 'Summary', exact: true }).locator('xpath=following::div[1]');

// The amount in the Summary block, e.g. "$2,500"
const amount = page => summaryBlock(page).locator('span').filter({ hasText: /^\$/ }).first();

// Line holding the amount; its pencil icon only renders on hover
const valueLine = page => amount(page).locator('xpath=ancestor::div[contains(@class,"justify-between")][1]');

/** Hovers the amount and opens the Value editor; returns its input, Save and Cancel. */
async function openValueEditor(page) {
  const line = valueLine(page);
  await line.scrollIntoViewIfNeeded();
  await line.hover();
  const pencil = line.locator('svg.lucide-pencil');
  await expect(pencil, 'Value: edit icon should show on hover').toBeVisible();
  await pencil.click();
  const box = summaryBlock(page);
  const save = box.getByRole('button', { name: 'Save', exact: true });
  await expect(save, 'Value: Save button should show').toBeVisible();
  return { input: box.getByRole('textbox').first(), save, cancel: box.getByRole('button', { name: 'Cancel', exact: true }) };
}

/**
 * Edits the lead Value through the hover pencil and verifies it is saved.
 * @param {import('@playwright/test').Page} page
 * @param {{ value: string, shown: string }} field shown: amount expected after save, e.g. "$75,000"
 */
async function editValue(page, { value, shown }) {
  await page.mouse.move(0, 0);
  await expect(valueLine(page).locator('svg.lucide-pencil'), 'Value: edit icon should be hidden before hover').toHaveCount(0);

  const { input, save, cancel } = await openValueEditor(page);
  await expect(cancel).toBeVisible();
  await input.fill(value);

  const [response] = await Promise.all([
    page.waitForResponse(r => LEAD_UPDATE_URL.test(r.url()) && r.request().method() === 'PUT'),
    save.click(),
  ]);
  expect(response.ok(), `Value: update API returned ${response.status()}`).toBeTruthy();

  await expect(save, 'Value: editor should close after save').toBeHidden();
  await expect(amount(page), 'Value: new amount should be displayed').toHaveText(shown);
  console.log(`Summary > Value saved as "${shown}"`);
}

/** Reloads the lead and waits for the left panel. */
async function reloadLead(page) {
  await page.reload();
  await expect(page.getByText('First name', { exact: true })).toBeVisible({ timeout: 30000 });
}

/**
 * Types `value` into Value and clicks Save without expecting it to work.
 * @returns {Promise<{ typed: string, error: string, stored: string }>}
 *   typed: what the box holds after typing; error: toast text; stored: amount shown after a reload
 */
async function tryValue(page, value) {
  const { input, save, cancel } = await openValueEditor(page);
  await input.fill(value);
  const typed = await input.inputValue();

  await save.click({ timeout: 3000 }).catch(() => {}); // a disabled Save also refuses the value
  await page.waitForTimeout(2000);
  const editorOpen = await save.isVisible();
  const error = (await errorToast(page).allInnerTexts()).join(' ').replace(/\s+/g, ' ').trim();
  if (editorOpen) await cancel.click();

  await reloadLead(page);
  return { typed, error, stored: await amount(page).innerText() };
}

/**
 * Same as expectRejected (dealDetails.js) for the Value field: types an invalid amount, clicks Save
 * and verifies that, after a reload, the valid amount is still stored and the user was told why.
 * Soft assertion, so every invalid value in a test is checked and reported.
 * @param {import('@playwright/test').Page} page
 * @param {{ value: string, shown: string }} valid the valid amount already saved
 * @param {string} invalid
 */
async function expectValueRejected(page, valid, invalid) {
  const { typed, error, stored } = await tryValue(page, invalid);
  const boxChanged = typed.replace(/\D/g, '') !== valid.value;
  const changed = stored !== valid.shown;

  const problems = [];
  if (changed) problems.push(`saved - Value now shows "${stored}"`);
  else if (boxChanged && !error) problems.push('not saved, but no error message was shown');
  expect.soft(problems, `Summary > Value "${invalid}" should be refused`).toEqual([]);

  const result = problems.length ? `NOT VALIDATED - ${problems.join('; ')}`
    : boxChanged ? `refused - "${error}"` : 'refused while typing';
  console.log(`Summary > Value "${invalid}": ${result}`);

  // Put the valid amount back so the next check starts from it
  if (changed) await editValue(page, valid);
}

module.exports = {
  openNewLead, summaryBlock, amount, valueLine, editValue, tryValue, expectValueRejected, reloadLead, LEAD_UPDATE_URL,
};
