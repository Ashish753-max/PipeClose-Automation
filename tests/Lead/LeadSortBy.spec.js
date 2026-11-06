const { test, expect } = require('@playwright/test');
const { openLeads } = require('../common/createLead');

// Only reads the Leads list; it changes no data. Run it on its own: Lead scripts adding or removing
// leads at the same time would shift the pages while it reads them.

const collator = new Intl.Collator('en', { sensitivity: 'base' }); // "Pipeclose" and "pipeclose" count as equal
const byText = (a, b) => collator.compare(a, b);
const byNumber = (a, b) => a - b;
const clean = text => String(text ?? '').replace(/\s+/g, ' ').trim();
const CATEGORY_RANK = { COLD: 1, WARM: 2, HOT: 3 };

// The "Sort by" options in dropdown order: the sortBy value each sends to the API, and the lead value the list must follow
const SORT_OPTIONS = [
  { name: 'Score (high to low)', sortBy: 'confidenceScore', value: l => l.confidenceScore ?? 0, compare: byNumber },
  { name: 'Category (Hot first)', sortBy: 'leadCategory', value: l => CATEGORY_RANK[l.leadCategory] ?? 0, show: l => l.leadCategory, compare: byNumber },
  { name: 'Lead title', sortBy: 'title', value: l => clean(l.title), compare: byText },
  { name: 'Linked organization', sortBy: 'company', value: l => clean(l.organizationName ?? l.organization?.name), compare: byText },
  { name: 'Lead created', sortBy: 'createdAt', value: l => Date.parse(l.createdAt), show: l => l.createdAt, compare: byNumber },
];

// The dropdown sits right after the "Sort by:" label and the direction button right before it (it has no name, only an arrow icon)
const sortLabel = page => page.getByText('Sort by:', { exact: true });
const sortDropdown = page => sortLabel(page).locator('xpath=following-sibling::button[@role="combobox"][1]');
const directionButton = page => sortLabel(page).locator('xpath=preceding-sibling::button[1]');
const directionArrow = (page, sortOrder) => directionButton(page).locator(sortOrder === 'desc' ? 'svg.lucide-arrow-down' : 'svg.lucide-arrow-up');
const leadCounter = page => page.getByText(/^\d+ leads?$/);
const leadRows = page => page.getByRole('row').filter({ has: page.getByRole('cell') });
// "Page 1 of 2" with the previous / next buttons after it
const pager = page => page.getByText(/^Page \d+ of \d+$/);
const previousPage = page => pager(page).locator('xpath=following-sibling::*').getByRole('button').first();
const nextPage = page => pager(page).locator('xpath=following-sibling::*').getByRole('button').last();

// The table has no id column, so rows are matched to the API's leads by what they show
const leadKey = l => [clean(l.personName) || '—', clean(l.organizationName ?? l.organization?.name) || '—',
  l.leadCategory ?? '', l.confidenceScore ?? ''].join(' | ');
const readRows = page => leadRows(page).evaluateAll(rows => rows.map(row => {
  const [, contact, organization, score] = [...row.querySelectorAll('td')].map(td => td.innerText.replace(/\s+/g, ' ').trim());
  const [, category = '', points = ''] = score.match(/^(\w+)?\s*Score:\s*(\d+)/) ?? [];
  return [contact, organization, category, points].join(' | ');
}));

/**
 * Runs the action, waits for the leads list it loads for this sort and page,
 * and returns that list in the order the table shows it.
 */
async function loadLeads(page, action, { sortBy, sortOrder, pageNo }, timeout = 30000) {
  const [response] = await Promise.all([
    page.waitForResponse(r => {
      if (!r.url().includes('/api/leads/get?')) return false;
      const query = new URL(r.url()).searchParams;
      return query.get('sortBy') === sortBy && query.get('sortOrder') === sortOrder && query.get('page') === String(pageNo);
    }, { timeout }),
    action(),
  ]);
  expect(response.ok(), `Leads API returned ${response.status()}`).toBeTruthy();
  const { leads, pagination } = (await response.json()).data;

  // Wait until the table shows exactly these leads, then read their order
  let shown;
  await expect.poll(async () => {
    const rows = await readRows(page);
    const left = [...leads];
    shown = rows.map(row => {
      const i = left.findIndex(l => leadKey(l) === row);
      return i < 0 ? null : left.splice(i, 1)[0];
    });
    const unmatched = rows.filter((row, i) => !shown[i]);
    return unmatched.length || left.length ? { notFromApi: unmatched, notShown: left.map(leadKey) } : 'table matches API';
  }, { message: `Table should show the leads the API returned for ${sortBy} ${sortOrder}, page ${pageNo}`, timeout: 15000 })
    .toBe('table matches API');
  return { shown, pagination };
}

/** Pairs of neighbouring leads that are in the wrong order for this option and direction. */
function outOfOrder(leads, option, sortOrder) {
  const show = option.show ?? option.value;
  const problems = [];
  for (let i = 0; i + 1 < leads.length; i++) {
    const diff = option.compare(option.value(leads[i]), option.value(leads[i + 1]));
    if (sortOrder === 'desc' ? diff < 0 : diff > 0) problems.push(`"${show(leads[i])}" is above "${show(leads[i + 1])}"`);
  }
  return problems;
}

/** Checks page 1 (already loaded) and page 2 are in order for this option and direction, then goes back to page 1. */
async function checkOrder(page, option, sortOrder, firstPage) {
  const label = `"${option.name}" ${sortOrder === 'desc' ? 'descending' : 'ascending'}`;
  await expect(directionArrow(page, sortOrder), `Direction button should show the ${sortOrder} arrow`).toBeVisible();
  await expect(sortDropdown(page)).toHaveText(option.name);
  await expect(pager(page)).toHaveText(new RegExp(`^Page 1 of ${firstPage.pagination.totalPages}$`));
  await expect(leadCounter(page), 'Sorting should not change the number of leads')
    .toHaveText(new RegExp(`^${firstPage.pagination.total} leads?$`));
  expect(firstPage.shown.length, 'Need at least 2 leads to check the order').toBeGreaterThan(1);
  expect.soft(outOfOrder(firstPage.shown, option, sortOrder), `${label}: page 1 should be in order`).toEqual([]);
  const show = option.show ?? option.value;
  console.log(`${label}, page 1: ${firstPage.shown.slice(0, 4).map(l => show(l)).join(', ')}, ...`);
  await page.screenshot({ path: `screenshots/Lead/LeadSortBy-${option.sortBy}-${sortOrder}.png` });

  if (firstPage.pagination.totalPages < 2) {
    console.log(`${label}: only one page, so the next page is not checked`);
    return;
  }
  const query = { sortBy: option.sortBy, sortOrder };
  const secondPage = await loadLeads(page, () => nextPage(page).click(), { ...query, pageNo: 2 });
  await expect(pager(page)).toHaveText(new RegExp(`^Page 2 of ${secondPage.pagination.totalPages}$`));
  expect.soft(outOfOrder(secondPage.shown, option, sortOrder), `${label}: page 2 should be in order`).toEqual([]);
  expect.soft(outOfOrder([firstPage.shown.at(-1), secondPage.shown[0]], option, sortOrder),
    `${label}: page 2 should carry on where page 1 stopped`).toEqual([]);
  console.log(`${label}, page 1 ends with "${show(firstPage.shown.at(-1))}", page 2 starts with "${show(secondPage.shown[0])}"`);
  await loadLeads(page, () => previousPage(page).click(), { ...query, pageNo: 1 });
}

test("Sort the Leads list with each Sort by option", async ({ page }) => {
  test.setTimeout(360000);

  await test.step('Default sort is "Lead created", newest first', async () => {
    const first = await loadLeads(page, () => openLeads(page), { sortBy: 'createdAt', sortOrder: 'desc', pageNo: 1 }, 90000);
    await expect(sortDropdown(page)).toHaveText('Lead created');
    await expect(directionArrow(page, 'desc')).toBeVisible();
    expect.soft(outOfOrder(first.shown, SORT_OPTIONS.at(-1), 'desc'), 'Leads should open newest first').toEqual([]);
  });

  await test.step('Sort by dropdown lists every option', async () => {
    await sortDropdown(page).click();
    await expect(page.getByRole('option')).toHaveText(SORT_OPTIONS.map(o => o.name));
    await page.screenshot({ path: 'screenshots/Lead/LeadSortBy-options.png' });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('option')).toHaveCount(0);
  });

  for (const option of SORT_OPTIONS) {
    await test.step(`Sort by "${option.name}"`, async () => {
      const query = { sortBy: option.sortBy, pageNo: 1 };

      // Selecting the option sorts descending (the default direction)
      const desc = await loadLeads(page, async () => {
        await sortDropdown(page).click();
        await page.getByRole('option', { name: option.name, exact: true }).click();
      }, { ...query, sortOrder: 'desc' });
      await checkOrder(page, option, 'desc', desc);

      // The arrow button turns it ascending, and back again
      const asc = await loadLeads(page, () => directionButton(page).click(), { ...query, sortOrder: 'asc' });
      await checkOrder(page, option, 'asc', asc);
      await loadLeads(page, () => directionButton(page).click(), { ...query, sortOrder: 'desc' });
      await expect(directionArrow(page, 'desc')).toBeVisible();
    });
  }
});
