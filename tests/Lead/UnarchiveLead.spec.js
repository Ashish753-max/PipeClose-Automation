const { test, expect } = require('@playwright/test');
const { openLeads, addLead } = require('../common/createLead');
const {
  leadRow, openRowMenu, archiveLead, openArchivedLeads, openListView, reloadListView, removeLeadForever, leadCount,
} = require('../common/archiveLead');

// Creates a fresh lead, archives it, then restores it with "Unarchive Lead" in the Archived view and
// checks it is back in the Leads List View. Screenshots are saved in screenshots/Lead/.
// Checks the "N leads" counters: run this file on its own, other Lead scripts running alongside would change them.

// The test lead, deleted after the test (also when it fails or times out) so runs don't fill up the Leads list
let testLead;
test.afterEach(async ({ page }) => {
  if (testLead) await removeLeadForever(page, testLead.id);
  testLead = undefined;
});

test('Unarchive a lead from the Archived view', async ({ page }) => {
  test.setTimeout(180000);
  await openLeads(page);
  // A fresh lead, so no real lead is ever archived ("Restore", not "Unarchive": the name must not match the success message)
  const lead = await addLead(page, 'LeadRestore');
  testLead = lead;
  await archiveLead(page, lead);
  const activeBefore = await leadCount(page);

  const archivedRow = leadRow(page, lead.person);
  let archivedBefore;

  await test.step('Archived lead is listed with Unarchive Lead and Delete Forever in its menu', async () => {
    const archived = await openArchivedLeads(page);
    expect(archived.map(l => l.id), 'Lead should be in Archived').toContain(lead.id);
    await expect(archivedRow, 'Lead should be listed in the Archived view').toHaveCount(1, { timeout: 30000 });
    await expect(archivedRow).toContainText(lead.organization);
    await expect(archivedRow).toContainText(lead.email);
    archivedBefore = await leadCount(page);

    await openRowMenu(page, lead.person);
    for (const option of ['Unarchive Lead', 'Delete Forever']) {
      await expect(page.getByRole('button', { name: option, exact: true }), `"${option}" should be in the menu`).toBeVisible();
    }
    for (const option of ['Archive Lead', 'Convert to Deal']) {
      await expect(page.getByRole('button', { name: option, exact: true }), `"${option}" should not be offered for an archived lead`)
        .toHaveCount(0);
    }
    await page.screenshot({ path: 'screenshots/Lead/UnarchiveLead-1-menu.png' });
  });

  await test.step('Unarchive Lead restores the lead straight away', async () => {
    // No confirmation is asked
    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith('/api/leads/unarchive') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Unarchive Lead', exact: true }).click(),
    ]);
    expect(response.ok(), `Unarchive API returned ${response.status()}`).toBeTruthy();
    expect(response.request().postDataJSON().leadIds, 'Only this lead should be unarchived').toEqual([lead.id]);
    await expect(page.getByRole('dialog'), 'Unarchive should not ask for confirmation').toHaveCount(0);

    await expect.soft(page.getByText(/unarchived/i).first(), 'A success message should be shown').toBeVisible({ timeout: 5000 });
    await expect(archivedRow, 'Lead should leave the Archived view').toHaveCount(0);
    await expect.poll(() => leadCount(page), { message: `Archived count should go from ${archivedBefore} to ${archivedBefore - 1}` })
      .toBe(archivedBefore - 1);
    await page.screenshot({ path: 'screenshots/Lead/UnarchiveLead-2-unarchived.png' });
    console.log(`Unarchived lead ${lead.id}: ${archivedBefore} -> ${archivedBefore - 1} archived leads`);
  });

  await test.step('Lead is back in the List View with its data, also after a reload', async () => {
    await openListView(page);
    const row = leadRow(page, lead.person);
    await expect(row, 'Unarchived lead should be back in the List View').toHaveCount(1, { timeout: 30000 });
    await expect(row).toContainText(lead.organization);
    await expect(row).toContainText(lead.email);
    await expect.poll(() => leadCount(page), { message: `Lead count should go from ${activeBefore} to ${activeBefore + 1}` })
      .toBe(activeBefore + 1);

    await reloadListView(page);
    await expect(leadRow(page, lead.person), 'Unarchived lead should stay in the List View after reload').toHaveCount(1);
    await page.screenshot({ path: 'screenshots/Lead/UnarchiveLead-3-in-list.png' });

    // Its Action menu is the one of an active lead again
    await openRowMenu(page, lead.person);
    await expect(page.getByRole('button', { name: 'Archive Lead', exact: true }), 'Lead should be archivable again').toBeVisible();
    await page.keyboard.press('Escape');

    // Gone from Archived for good
    const archivedAfter = await openArchivedLeads(page);
    expect(archivedAfter.map(l => l.id), 'Lead should not be in Archived after reload').not.toContain(lead.id);
    await expect(leadRow(page, lead.person)).toHaveCount(0);
  });
});
