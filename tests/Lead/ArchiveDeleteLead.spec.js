const { test, expect } = require('@playwright/test');
const { openLeads, addLead, leadCount } = require('../common/createLead');

// Both tests check the "N leads" counter, so they must not add or remove leads at the same time.
// Run this file on its own: other Lead scripts running alongside would change the counter too.
test.describe.configure({ mode: 'serial' });

const leadRow = (page, person) => page.getByRole('row').filter({ has: page.getByRole('cell', { name: person, exact: true }) });

/** Opens the three-dots menu in the Action column of the lead's row and checks its options. */
async function openActionMenu(page, person) {
  // The three-dots button has no label; it is the only button in the Action column
  await leadRow(page, person).getByRole('cell').last().getByRole('button').click();
  for (const option of ['Convert to Deal', 'Move to list', 'Archive Lead', 'Delete Lead']) {
    await expect(page.getByRole('button', { name: option, exact: true }), `"${option}" should be in the menu`).toBeVisible();
  }
}

/** Reloads the Leads list and checks the lead is still gone and the counter still lowered. */
async function expectGoneAfterReload(page, person, count) {
  await page.reload();
  await expect.poll(() => leadCount(page), { message: 'Lead count should stay lowered after reload', timeout: 30000 }).toBe(count);
  await expect(page.getByRole('row').nth(1)).toBeVisible({ timeout: 30000 });
  await expect(leadRow(page, person), 'Lead should not come back after reload').toHaveCount(0);
}

test("Archive a lead from the Action menu", async ({ page }) => {
  test.setTimeout(180000);
  await openLeads(page);
  // A fresh lead, so no real lead is ever archived
  const lead = await addLead(page, 'LeadArchive');
  const countBefore = await leadCount(page);

  await openActionMenu(page, lead.person);
  const [response] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/api/leads/archive') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Archive Lead', exact: true }).click(),
  ]);
  expect(response.ok(), `Archive API returned ${response.status()}`).toBeTruthy();
  expect(response.request().postDataJSON().leadIds, 'Only this lead should be archived').toEqual([lead.id]);

  // Success message, row leaves the list and the counter goes down by one
  await expect.soft(page.getByRole('heading', { name: 'Lead archived', exact: true }),
    'Success message "Lead archived" should be shown').toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: 'screenshots/LeadArchive-archived.png' });
  await expect(leadRow(page, lead.person), 'Archived lead should leave the list').toHaveCount(0);
  await expect.poll(() => leadCount(page), { message: `Lead count should go from ${countBefore} to ${countBefore - 1}` })
    .toBe(countBefore - 1);
  console.log(`Archived lead ${lead.id}: ${countBefore} -> ${countBefore - 1} leads`);

  await expectGoneAfterReload(page, lead.person, countBefore - 1);

  // Listed under Archived
  await page.getByRole('button', { name: 'Archived', exact: true }).click();
  await expect(page.getByRole('cell', { name: lead.person, exact: true }), 'Lead should be listed under Archived')
    .toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: 'screenshots/LeadArchive-in-archived.png' });
});

test("Delete a lead from the Action menu", async ({ page }) => {
  test.setTimeout(180000);
  await openLeads(page);
  // A fresh lead, so no real lead is ever deleted
  const lead = await addLead(page, 'LeadDelete');
  const countBefore = await leadCount(page);

  // Delete asks for confirmation; Cancel keeps the lead
  await openActionMenu(page, lead.person);
  await page.getByRole('button', { name: 'Delete Lead', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Delete Lead?', level: 3 })).toBeVisible();
  await expect(dialog).toContainText(`Delete "${lead.title}"?`);
  await expect(dialog).toContainText('This lead will be moved to the trash and deleted.');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog, 'Cancel should close the dialog').toBeHidden();
  await expect(leadRow(page, lead.person), 'Cancel should keep the lead').toHaveCount(1);
  expect(await leadCount(page), 'Cancel should not change the count').toBe(countBefore);

  // Delete for real
  await openActionMenu(page, lead.person);
  await page.getByRole('button', { name: 'Delete Lead', exact: true }).click();
  await expect(dialog).toContainText(`Delete "${lead.title}"?`);
  await page.screenshot({ path: 'screenshots/LeadDelete-confirm.png' });
  const [response] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith(`/api/leads/delete/${lead.id}`) && r.request().method() === 'DELETE'),
    dialog.getByRole('button', { name: 'Delete', exact: true }).click(),
  ]);
  expect(response.ok(), `Delete API returned ${response.status()}`).toBeTruthy();

  // Success message, row leaves the list and the counter goes down by one
  await expect.soft(page.getByRole('heading', { name: 'Lead deleted', exact: true }),
    'Success message "Lead deleted" should be shown').toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: 'screenshots/LeadDelete-deleted.png' });
  await expect(dialog).toBeHidden();
  await expect(leadRow(page, lead.person), 'Deleted lead should leave the list').toHaveCount(0);
  await expect.poll(() => leadCount(page), { message: `Lead count should go from ${countBefore} to ${countBefore - 1}` })
    .toBe(countBefore - 1);
  console.log(`Deleted lead ${lead.id}: ${countBefore} -> ${countBefore - 1} leads`);

  await expectGoneAfterReload(page, lead.person, countBefore - 1);
});
