const { test, expect } = require('@playwright/test');
const { openLeads, addLead } = require('../common/createLead');
const { leadRow, openRowMenu, removeLeadForever } = require('../common/archiveLead');
const {
  BASE_URL, leadsResponse, readLeads, loadLeads, leadRows, expectTableShows,
  leadCounter, counterText, pagerText, nextPage, pageLabel,
} = require('../common/leadList');

// Filters of the Leads List View: the Temperature buttons (All / Hot / Warm / Cold) and the Lists menu
// (a list, Unlisted, All leads). What each filter must show is read from the API the page calls.
// Screenshots are saved in screenshots/Lead/.
// Run this file on its own: other Lead scripts adding or removing leads alongside would change the counts.

const TEMPERATURES = [
  { name: 'Hot', category: 'HOT' },
  { name: 'Warm', category: 'WARM' },
  { name: 'Cold', category: 'COLD' },
];

const temperatureGroup = page => page.getByRole('group', { name: 'Filter leads by temperature' });
// "🔥 Hot · 1", "☀️ Warm · 3", "❄️ Cold · 25"
const temperatureButton = (page, name) => temperatureGroup(page).getByRole('button', { name: new RegExp(`${name} · \\d+$`) });
const allButton = page => temperatureGroup(page).getByRole('button', { name: 'All', exact: true });

/** The number shown on each temperature button, e.g. { Hot: 1, Warm: 3, Cold: 25 }. */
async function temperatureCounts(page) {
  const counts = {};
  for (const { name } of TEMPERATURES) {
    counts[name] = Number((await temperatureButton(page, name).innerText()).match(/· (\d+)/)[1]);
  }
  return counts;
}

/** Temperature each table row shows ("Lead temperature: Cold" -> "Cold"). */
const shownTemperatures = page => leadRows(page).getByTestId('lead-temperature')
  .evaluateAll(chips => chips.map(c => c.getAttribute('aria-label').replace('Lead temperature: ', '')));

/** Checks only `pressed` is pressed in the Temperature group. */
async function expectPressed(page, pressed) {
  await expect(allButton(page), `"All" should be ${pressed === 'All' ? '' : 'not '}pressed`)
    .toHaveAttribute('aria-pressed', String(pressed === 'All'));
  for (const { name } of TEMPERATURES) {
    await expect(temperatureButton(page, name), `"${name}" should be ${pressed === name ? '' : 'not '}pressed`)
      .toHaveAttribute('aria-pressed', String(pressed === name));
  }
}

test.describe('Lead filters', () => {
  test('Filter leads by temperature: All, Hot, Warm and Cold', async ({ page }) => {
    test.setTimeout(180000);
    const firstList = leadsResponse(page, q => !q.has('category') && !q.has('search') && q.get('page') === '1');
    await openLeads(page);
    const all = await readLeads(await firstList);
    const total = all.pagination.total;

    let counts;
    await test.step('All is selected by default and the temperature counts add up to all leads', async () => {
      await expect(temperatureGroup(page)).toContainText('Temperature:');
      await expectPressed(page, 'All');
      await expect(leadCounter(page)).toHaveText(counterText(total));
      counts = await temperatureCounts(page);
      console.log(`All: ${total} leads; ${TEMPERATURES.map(t => `${t.name} ${counts[t.name]}`).join(', ')}`);
      expect.soft(counts.Hot + counts.Warm + counts.Cold, 'Hot + Warm + Cold should equal all leads').toBe(total);
      await page.screenshot({ path: 'screenshots/Lead/LeadFilters-temperature-all.png' });
    });

    for (const { name, category } of TEMPERATURES) {
      await test.step(`${name} shows only ${name} leads`, async () => {
        const { leads, pagination, query } = await loadLeads(page, temperatureButton(page, name), q => q.get('category') === category);
        expect(query.get('page'), 'A new filter should start on page 1').toBe('1');
        await expectPressed(page, name);

        // Server, button count, counter, pager and table all agree
        expect(leads.every(l => l.leadCategory === category), `API should only return ${category} leads`).toBeTruthy();
        expect(pagination.total, `"${name}" button count should match the leads found`).toBe(counts[name]);
        await expect(leadCounter(page)).toHaveText(counterText(pagination.total));
        await expect(pagerText(page)).toHaveText(pageLabel(1, pagination.totalPages));
        await expectTableShows(page, leads, `Table should show the ${name} leads from the API`);
        expect(await shownTemperatures(page), `Every row should be ${name}`).toEqual(leads.map(() => name));
        await page.screenshot({ path: `screenshots/Lead/LeadFilters-temperature-${name.toLowerCase()}.png` });
        console.log(`${name}: ${pagination.total} leads, ${pagination.totalPages} page(s)`);

        // The filter is kept on the next page
        if (pagination.totalPages > 1) {
          const second = await loadLeads(page, nextPage(page), q => q.get('page') === '2');
          expect(second.query.get('category'), `Page 2 should keep the ${name} filter`).toBe(category);
          await expect(pagerText(page)).toHaveText(pageLabel(2, pagination.totalPages));
          await expectTableShows(page, second.leads, `Page 2 should show the next ${name} leads`);
          expect(await shownTemperatures(page), `Every row on page 2 should be ${name}`).toEqual(second.leads.map(() => name));
          await expect(leadCounter(page), 'Counter should not change between pages').toHaveText(counterText(pagination.total));
        }
      });
    }

    await test.step('All shows every lead again', async () => {
      const back = await loadLeads(page, allButton(page), q => !q.has('category'));
      expect(back.query.get('page'), 'All should start on page 1').toBe('1');
      await expectPressed(page, 'All');
      expect(back.pagination.total, 'All should list every lead again').toBe(total);
      await expect(leadCounter(page)).toHaveText(counterText(total));
      await expectTableShows(page, back.leads, 'Table should show all leads again');
    });

    await test.step('Temperature counts follow the search', async () => {
      // A search nothing matches: every count drops to 0, clearing it brings them back
      const search = page.getByPlaceholder('Search leads..');
      const none = `nomatch${Date.now()}`;
      const [found] = await Promise.all([leadsResponse(page, q => q.get('search') === none), search.fill(none)]);
      expect((await readLeads(found)).pagination.total).toBe(0);
      await expect(leadCounter(page)).toHaveText(counterText(0));
      await expect.poll(() => temperatureCounts(page), { message: 'Temperature counts should drop to 0 for a search with no match' })
        .toEqual({ Hot: 0, Warm: 0, Cold: 0 });
      await expect(leadRows(page)).toHaveCount(0);
      await page.screenshot({ path: 'screenshots/Lead/LeadFilters-temperature-search.png' });

      await Promise.all([leadsResponse(page, q => !q.has('search')), search.fill('')]);
      await expect(leadCounter(page)).toHaveText(counterText(total));
      await expect.poll(() => temperatureCounts(page), { message: 'Temperature counts should come back after clearing the search' })
        .toEqual(counts);
    });
  });

  // The test lead and list, removed after the test (also when it fails)
  let testLead;
  let testList;
  test.afterEach(async ({ page }) => {
    if (testList) {
      const response = await page.request.delete(`${BASE_URL}/api/leads/folders/${testList.id}`).catch(e => e);
      if (response.ok?.()) console.log(`Cleanup: deleted list ${testList.id} "${testList.name}"`);
      else console.warn(`Cleanup: could not delete list ${testList.id}: ${response.status?.() ?? response.message}`);
    }
    if (testLead) await removeLeadForever(page, testLead.id);
    testLead = undefined;
    testList = undefined;
  });

  test('Filter leads by list: a list, Unlisted and All leads', async ({ page }) => {
    test.setTimeout(180000);
    await openLeads(page);
    // A fresh lead and a fresh list, so no real lead or list is changed
    const lead = await addLead(page, 'LeadListFilter');
    testLead = lead;
    const listName = `Filterlist${Date.now().toString().slice(-6)}`;

    const listsPanel = page.getByRole('dialog');
    const listsButton = name => page.getByRole('main').getByRole('button', { name, exact: true });
    const panelItem = name => listsPanel.getByRole('button', { name: new RegExp(`^${name} \\d+$`) });
    const panelCount = async name => Number((await panelItem(name).innerText()).match(/(\d+)\s*$/)[1]);
    const openPanel = async name => {
      await listsButton(name).click();
      await expect(listsPanel.getByRole('button', { name: 'All leads', exact: true })).toBeVisible();
    };

    await test.step('Create a new list from the Lists menu', async () => {
      await openPanel('Lists');
      await listsPanel.getByRole('button', { name: 'New list', exact: true }).click();
      await listsPanel.getByRole('textbox', { name: 'New list name' }).fill(listName);
      const [response] = await Promise.all([
        page.waitForResponse(r => r.url().endsWith('/api/leads/folders') && r.request().method() === 'POST'),
        listsPanel.getByRole('button', { name: 'Create list', exact: true }).click(),
      ]);
      expect(response.ok(), `Create list API returned ${response.status()}`).toBeTruthy();
      testList = (await response.json()).data.folder;
      await expect.soft(page.getByRole('heading', { name: 'List created', exact: true }), 'Success message "List created" should be shown')
        .toBeVisible({ timeout: 5000 });
      await expect(panelItem(listName), 'New list should be in the Lists menu with 0 leads').toHaveText(new RegExp(`${listName}\\s*0$`));
      console.log(`Created list ${testList.id} "${listName}"`);
      await page.keyboard.press('Escape');
      await expect(listsPanel).toBeHidden();
    });

    let unlistedBefore;
    await test.step('Move the lead to the list', async () => {
      await openPanel('Lists');
      unlistedBefore = await panelCount('Unlisted');
      await page.keyboard.press('Escape');

      await openRowMenu(page, lead.person);
      await page.getByRole('button', { name: 'Move to list', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('heading', { name: 'Move 1 lead to list', level: 3 })).toBeVisible();
      await dialog.getByRole('button', { name: 'Unlisted', exact: true }).click(); // list picker, starts on Unlisted
      await page.getByRole('listitem').getByRole('button', { name: listName, exact: true }).click();
      const [response] = await Promise.all([
        page.waitForResponse(r => r.url().endsWith('/api/leads/folders/assign') && r.request().method() === 'POST'),
        dialog.getByRole('button', { name: 'Move', exact: true }).click(),
      ]);
      expect(response.ok(), `Move to list API returned ${response.status()}`).toBeTruthy();
      expect(response.request().postDataJSON(), 'Only this lead should move, to this list').toEqual({ leadIds: [lead.id], folderId: testList.id });
      await expect(dialog).toBeHidden();

      await openPanel('Lists');
      await expect.poll(() => panelCount(listName), { message: 'List should count 1 lead' }).toBe(1);
      await expect.poll(() => panelCount('Unlisted'), { message: `Unlisted should go from ${unlistedBefore} to ${unlistedBefore - 1}` })
        .toBe(unlistedBefore - 1);
      await page.screenshot({ path: 'screenshots/Lead/LeadFilters-lists-menu.png' });
    });

    await test.step('Picking the list shows only its lead', async () => {
      const { leads, pagination } = await loadLeads(page, panelItem(listName), q => q.get('folderId') === String(testList.id));
      expect(leads.map(l => l.id), 'API should only return the lead in this list').toEqual([lead.id]);
      expect(pagination.total).toBe(1);
      await expect(listsButton(listName), 'Lists button should show the picked list').toBeVisible();
      await expect(leadCounter(page)).toHaveText(counterText(1));
      await expect(pagerText(page)).toHaveText(pageLabel(1, 1));
      await expect(leadRows(page)).toHaveCount(1);
      await expect(leadRow(page, lead.person), 'The lead should be the only row').toHaveCount(1);
      await expect.poll(async () => Object.values(await temperatureCounts(page)).reduce((a, b) => a + b),
        { message: 'Temperature counts should add up to the 1 lead in the list' }).toBe(1);
      await page.screenshot({ path: 'screenshots/Lead/LeadFilters-list-picked.png' });
    });

    await test.step('Unlisted no longer shows the lead', async () => {
      await openPanel(listName);
      const { leads, pagination } = await loadLeads(page, panelItem('Unlisted'), q => q.get('folderId') === 'unfiled');
      expect(leads.map(l => l.id), 'Lead in a list should not be Unlisted').not.toContain(lead.id);
      expect(pagination.total, 'Unlisted total should match the Lists menu').toBe(unlistedBefore - 1);
      await expect(leadCounter(page)).toHaveText(counterText(pagination.total));
      await expectTableShows(page, leads, 'Table should show the Unlisted leads from the API');
      await expect(leadRow(page, lead.person)).toHaveCount(0);
      await page.screenshot({ path: 'screenshots/Lead/LeadFilters-unlisted.png' });
    });

    await test.step('All leads shows every lead, the listed one too', async () => {
      await openPanel('Unlisted');
      const { leads, query } = await loadLeads(page, listsPanel.getByRole('button', { name: 'All leads', exact: true }), q => !q.has('folderId'));
      expect(query.get('page')).toBe('1');
      expect(leads.map(l => l.id), 'Newest leads come first, so the test lead should be on page 1').toContain(lead.id);
      await expect(listsButton('Lists'), 'Lists button should go back to "Lists"').toBeVisible();
      await expect(leadRow(page, lead.person), 'The listed lead should be in All leads').toHaveCount(1);
    });
  });
});
