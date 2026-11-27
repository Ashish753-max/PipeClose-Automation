const { test, expect } = require('@playwright/test');
const { openLeads, addLead } = require('../common/createLead');
const {
  leadRow, openRowMenu, archiveLead, openArchivedLeads, reloadListView, removeLeadForever, leadCount,
} = require('../common/archiveLead');

// Creates a fresh lead, archives it, then deletes it with "Delete Forever" in the Archived view:
// Cancel keeps it, confirming removes it from Archived and from the List View for good.
// Screenshots are saved in screenshots/Lead/.
// Checks the "N leads" counter: run this file on its own, other Lead scripts running alongside would change it.

// The test lead, removed after the test if the test failed before deleting it
let testLead;
test.afterEach(async ({ page }) => {
  if (testLead) await removeLeadForever(page, testLead.id);
  testLead = undefined;
});

test('Delete a lead forever from the Archived view', async ({ page }) => {
  test.setTimeout(180000);
  await openLeads(page);
  // A fresh lead, so no real lead is ever deleted ("Purge", not "Delete": the name must not match the success message)
  const lead = await addLead(page, 'LeadPurge');
  testLead = lead;
  await archiveLead(page, lead);

  const archivedRow = leadRow(page, lead.person);
  const dialog = page.getByRole('dialog');
  let archivedBefore;

  await test.step('Archived lead is listed in the Archived view', async () => {
    const archived = await openArchivedLeads(page);
    expect(archived.map(l => l.id), 'Lead should be in Archived').toContain(lead.id);
    await expect(archivedRow, 'Lead should be listed in the Archived view').toHaveCount(1, { timeout: 30000 });
    archivedBefore = await leadCount(page);
  });

  await test.step('Delete Forever asks for confirmation and Cancel keeps the lead', async () => {
    await openRowMenu(page, lead.person);
    await page.getByRole('button', { name: 'Delete Forever', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'Permanently Delete Lead?', level: 3 })).toBeVisible();
    await expect(dialog).toContainText(`Delete "${lead.title}"?`);
    await expect(dialog).toContainText('This is permanent and cannot be undone.');
    await expect(dialog).toContainText('All associated activities, notes, and history will be lost forever.');
    await page.screenshot({ path: 'screenshots/Lead/DeleteArchivedLead-1-confirm.png' });

    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog, 'Cancel should close the dialog').toBeHidden();
    await expect(archivedRow, 'Cancel should keep the lead in Archived').toHaveCount(1);
    expect(await leadCount(page), 'Cancel should not change the archived count').toBe(archivedBefore);
  });

  await test.step('Confirming Delete Forever removes the lead from Archived', async () => {
    await openRowMenu(page, lead.person);
    await page.getByRole('button', { name: 'Delete Forever', exact: true }).click();
    await expect(dialog).toContainText(`Delete "${lead.title}"?`);
    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith('/api/leads/archived/permanent') && r.request().method() === 'DELETE'),
      dialog.getByRole('button', { name: 'Delete Forever', exact: true }).click(),
    ]);
    expect(response.ok(), `Delete API returned ${response.status()}`).toBeTruthy();
    expect(response.request().postDataJSON().leadIds, 'Only this lead should be deleted').toEqual([lead.id]);
    testLead = undefined; // deleted: nothing left to clean up

    await expect.soft(page.getByText(/deleted/i).first(), 'A success message should be shown').toBeVisible({ timeout: 5000 });
    await expect(dialog).toBeHidden();
    await expect(archivedRow, 'Deleted lead should leave the Archived view').toHaveCount(0);
    await expect.poll(() => leadCount(page), { message: `Archived count should go from ${archivedBefore} to ${archivedBefore - 1}` })
      .toBe(archivedBefore - 1);
    await page.screenshot({ path: 'screenshots/Lead/DeleteArchivedLead-2-deleted.png' });
    console.log(`Deleted lead ${lead.id} forever: ${archivedBefore} -> ${archivedBefore - 1} archived leads`);
  });

  await test.step('Lead is gone for good: not in Archived nor in the List View after a reload', async () => {
    await reloadListView(page);
    await expect(leadRow(page, lead.person), 'Deleted lead should not come back to the List View').toHaveCount(0);
    const archivedAfter = await openArchivedLeads(page);
    expect(archivedAfter.map(l => l.id), 'Deleted lead should not come back to Archived').not.toContain(lead.id);
    await expect(leadRow(page, lead.person)).toHaveCount(0);
  });
});
