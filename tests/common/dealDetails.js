// tests/common/dealDetails.js
// Shared flow for the Deal Details scripts (tests/Deal Details/*.spec.js)
const { expect } = require('@playwright/test');
const { createDeal } = require('./createDeal');

// Field update request (the page also POSTs /deals/ai/analyze on its own, so match only this)
const UPDATE_URL = /\/api\/(persons|organisations|deals)\/\d+$/;

/**
 * Creates a fresh deal and opens its details page.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string>} the person name used for the deal
 */
async function openNewDeal(page) {
  const stamp = Date.now().toString().slice(-6);
  const person = `Detail${stamp}`;
  await createDeal(page, {
    person,
    organization: `DetailOrg${stamp}`,
    value: '2500',
    phone: '9876543210',
    email: 'deal.details@gmail.com',
    screenshot: 'DealDetails-created.png',
  }, { checkSuccessMessage: false });

  await page.getByRole('heading', { name: new RegExp(`^${person} - `), level: 4 }).first().click();
  await expect(page).toHaveURL(/\/deals\/\d+/);
  await expect(page.getByRole('heading', { name: new RegExp(`^${person} - `), level: 1 })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('First name', { exact: true })).toBeVisible({ timeout: 30000 });
  console.log(`Opened deal ${page.url()}`);
  return person;
}

/**
 * Row of a field in the left panel. Person rows come before Organization rows,
 * which matters for labels that exist in both ("LinkedIn profile").
 * @param {'Person'|'Organization'} section
 */
function fieldRow(page, section, label) {
  const labels = page.getByText(label, { exact: true });
  return (section === 'Person' ? labels.first() : labels.last())
    .locator('xpath=ancestor::div[contains(@class,"relative")][1]');
}

/**
 * Edits one field through the hover edit icon and verifies it is saved.
 * @param {import('@playwright/test').Page} page
 * @param {{ section: 'Person'|'Organization', label: string, value: string, option?: boolean, shown?: string }} field
 *   option: pick `value` from the field's dropdown; shown: text expected after save (defaults to value)
 */
async function editField(page, { section, label, value, option = false, shown = value }) {
  const row = fieldRow(page, section, label);
  await row.scrollIntoViewIfNeeded();

  // Edit icon is only shown on hover
  const editIcon = row.getByRole('button').first();
  await page.mouse.move(0, 0);
  await expect(row.getByRole('button', { name: `Edit ${label}` }), `${label}: edit icon should be hidden before hover`)
    .toHaveCount(0);
  await row.hover();
  await expect(editIcon, `${label}: edit icon should show on hover`).toBeVisible();
  await editIcon.click();

  // Field opens with Save and Cancel
  const save = row.getByRole('button', { name: 'Save', exact: true });
  await expect(save, `${label}: Save button should show`).toBeVisible();
  await expect(row.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();

  if (option) {
    // Retried: the page re-renders after the previous save, which can close the dropdown just opened
    await expect(async () => {
      await row.getByRole('combobox').or(row.getByRole('button').filter({ hasText: '(None)' })).first().click();
      await page.getByText(value, { exact: true }).last().click({ timeout: 5000 });
    }).toPass({ timeout: 30000 });
  } else {
    const input = row.locator('input:not([type=file]), textarea').first();
    await input.fill(value);
  }

  // Save and wait for the update request
  const [response] = await Promise.all([
    page.waitForResponse(r => UPDATE_URL.test(r.url()) && ['PATCH', 'PUT'].includes(r.request().method())),
    save.click(),
  ]);
  expect(response.ok(), `${label}: update API returned ${response.status()}`).toBeTruthy();

  // Editor closes and the new value is displayed
  await expect(save, `${label}: editor should close after save`).toBeHidden();
  await expect(row, `${label}: new value should be displayed`).toContainText(shown);
  console.log(`${section} > ${label} saved as "${shown}"`);
}

/** Reloads the page and checks every edited value is still there. */
async function expectSavedAfterReload(page, fields) {
  await page.reload();
  await expect(page.getByText('First name', { exact: true })).toBeVisible({ timeout: 30000 });
  for (const { section, label, value, shown = value } of fields) {
    await expect(fieldRow(page, section, label), `${label}: value should stay after reload`).toContainText(shown);
  }
}

// Inline error under a field, e.g. "LinkedIn URL cannot contain spaces"
const errorMessage = row => row.locator('[role="alert"], [class*="text-red"], [class*="text-destructive"]')
  .filter({ hasText: /\S/ });

// Error toast at the top right, e.g. "Update Failed" + the server message (closes by itself)
const errorToast = page => page.getByRole('heading', { level: 3, name: /fail|error/i }).locator('xpath=..');

// Ignores formatting the box adds, e.g. "(987) 654-3210"
const plain = text => text.replace(/[\s()+-]/g, '');

/**
 * Types an invalid value, clicks Save and verifies it is refused: an error message is shown
 * (under the field or as a toast) and, after a reload, the valid value is still stored.
 * If the box itself refuses the characters and keeps the valid value, only the stored value is checked.
 * Soft assertion, so every invalid value in a test is checked and reported.
 * @param {import('@playwright/test').Page} page
 * @param {{ section: 'Person'|'Organization', label: string, value: string, shown?: string }} valid
 *   the valid value already saved in the field (same shape as editField)
 * @param {string} invalid
 * @param {string} [message] expected error text
 */
async function expectRejected(page, valid, invalid, message) {
  const { section, label } = valid;
  const kept = valid.shown ?? valid.value;
  const what = `${section} > ${label} "${invalid}"`;

  const row = fieldRow(page, section, label);
  await row.scrollIntoViewIfNeeded();
  await row.hover();
  const editIcon = row.getByRole('button').first();
  await expect(editIcon).toBeVisible();
  await editIcon.click();
  const save = row.getByRole('button', { name: 'Save', exact: true });
  await expect(save).toBeVisible();

  const input = row.locator('input:not([type=file]), textarea').first();
  await input.fill(invalid);
  const boxChanged = plain(await input.inputValue()) !== plain(valid.value);

  await save.click({ timeout: 3000 }).catch(() => {}); // a disabled Save also refuses the value
  await page.waitForTimeout(2000);
  const editorOpen = await save.isVisible();
  const error = [...(editorOpen ? await errorMessage(row).allInnerTexts() : []), ...await errorToast(page).allInnerTexts()]
    .join(' ').replace(/\s+/g, ' ').trim();
  if (editorOpen) await row.getByRole('button', { name: 'Cancel', exact: true }).click();

  // The valid value must still be stored
  await page.reload();
  await expect(page.getByText('First name', { exact: true })).toBeVisible({ timeout: 30000 });
  const after = fieldRow(page, section, label);
  await expect(after).toContainText(kept, { timeout: 5000 }).catch(() => {});
  const stored = (await after.innerText()).replace(label, '').trim();
  const changed = !stored.includes(kept);

  const problems = [];
  if (changed) problems.push(`saved - field now shows "${stored}"`);
  else if (boxChanged && !error) problems.push('not saved, but no error message was shown');
  else if (message && error && !error.includes(message)) problems.push(`error says "${error}" instead of "${message}"`);
  expect.soft(problems, `${what} should be refused`).toEqual([]);

  const result = problems.length ? `NOT VALIDATED - ${problems.join('; ')}`
    : boxChanged ? `refused - "${error}"` : 'refused while typing';
  console.log(`${what}: ${result}`);

  // Put the valid value back so the next check starts from it
  if (changed) await editField(page, valid);
}

module.exports = { openNewDeal, fieldRow, editField, expectSavedAfterReload, expectRejected, errorToast };
