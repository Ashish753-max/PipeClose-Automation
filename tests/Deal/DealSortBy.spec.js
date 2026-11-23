const { test, expect } = require('@playwright/test');
const { loginStaging } = require('../common/createDeal');

// Sorts the Deals List View with each "Sort by" option, both directions, and checks page 1 and page 2.
// Only reads the list; it changes no data. Run it on its own: Deal scripts adding or removing deals
// at the same time would shift the pages while it reads them.
//
// The Deals list sorts in the browser (no sort is sent to /api/deals/get), so the deal values are
// taken from the page the API loaded and matched to the table rows.

const collator = new Intl.Collator('en', { sensitivity: 'base' }); // "Microsoft AI" and "Microsoft Ai" count as equal
const byText = (a, b) => collator.compare(a, b);
const byNumber = (a, b) => a - b;
const clean = text => String(text ?? '').replace(/\s+/g, ' ').trim();

// The "Sort by" options in dropdown order, and the deal value the list must follow
const SORT_OPTIONS = [
  { name: 'Deal title', value: d => clean(d.title), compare: byText },
  { name: 'Deal value', value: d => Number(d.value ?? 0), compare: byNumber },
  { name: 'Linked organization', value: d => clean(d.organizationName ?? d.organization?.name), compare: byText },
  { name: 'Deal created', value: d => Date.parse(d.createdAt), show: d => d.createdAt, compare: byNumber },
  { name: 'Deal update time', value: d => Date.parse(d.updatedAt), show: d => d.updatedAt, compare: byNumber },
];
const DEFAULT_OPTION = SORT_OPTIONS.find(o => o.name === 'Deal created');

// The dropdown sits right after the "Sort by:" label and the direction button right before it
// (no name, only an arrow icon; its title says the current direction: "Sort descending" / "Sort ascending")
const sortLabel = page => page.getByText('Sort by:', { exact: true });
const sortDropdown = page => sortLabel(page).locator('xpath=following-sibling::*[1]').getByRole('combobox');
const directionButton = page => sortLabel(page).locator('xpath=preceding-sibling::button[1]');
const directionTitle = sortOrder => (sortOrder === 'desc' ? 'Sort descending' : 'Sort ascending');
const dealCounter = page => page.getByText(/^\d+ deals?$/).first();
const dealRows = page => page.getByRole('row').filter({ has: page.getByRole('cell') });
// "Page 1 of 11" with the previous / next buttons after it
const pager = page => page.getByText(/^Page \d+ of \d+$/);
const previousPage = page => pager(page).locator('xpath=following-sibling::*').getByRole('button').first();
const nextPage = page => pager(page).locator('xpath=following-sibling::*').getByRole('button').last();

// The table has no id column, so rows are matched to the API's deals by title, organization and email
// Columns: checkbox, Title, Original value, Value (USD), Organization, Contact person, Details, Phone, Email, Web URL, Action
const readRows = page => dealRows(page).evaluateAll(rows => rows.map(row => {
  const td = [...row.querySelectorAll('td')].map(cell => cell.innerText.replace(/\s+/g, ' ').trim());
  return { title: td[1], organization: td[4], email: td[8] };
}));
const dealEmails = d => [...(d.emails ?? []), ...(d.person?.emails ?? [])].map(e => clean(e.value ?? e.email));
const sameDeal = (row, d) => row.title === clean(d.title)
  && collator.compare(row.organization, clean(d.organizationName ?? d.organization?.name) || '—') === 0
  && (dealEmails(d).length ? dealEmails(d).includes(row.email) : row.email === '—');

/** The deals of each list page, as the API sent them, by page number. */
function watchPages(page) {
  const pages = new Map();
  page.on('response', async r => {
    if (!r.url().includes('/api/deals/get?') || r.request().method() !== 'GET') return;
    const query = new URL(r.url()).searchParams;
    // Rows per page is 20. A status filter ("All open deals") may be on: it is kept between visits.
    // (The page also polls "limit=1&filter=open" for the counter, and the board loads "limit=1000".)
    if (query.get('limit') !== '20') return;
    const body = await r.json().catch(() => null);
    if (body?.data?.deals) pages.set(Number(query.get('page')), body.data);
  });
  return pages;
}

/** Waits until the table shows exactly the deals the API sent for this page, and returns them in table order. */
async function shownDeals(page, pages, pageNo) {
  let shown;
  let hidden = [];
  await expect.poll(async () => {
    const data = pages.get(pageNo);
    if (!data) return `page ${pageNo} not loaded yet`;
    const rows = await readRows(page);
    const left = [...data.deals];
    shown = rows.map(row => {
      const i = left.findIndex(d => sameDeal(row, d));
      return i < 0 ? null : left.splice(i, 1)[0];
    });
    const unmatched = rows.filter((row, i) => !shown[i]).map(r => `${r.title} | ${r.organization} | ${r.email}`);
    // Deals left over are hidden by the status filter (e.g. won/lost deals under "All open deals")
    hidden = left;
    return rows.length && !unmatched.length ? 'table matches API' : { notFromApi: unmatched, rows: rows.length };
  }, { message: `Every row on page ${pageNo} should be a deal the API returned`, timeout: 30000 }).toBe('table matches API');
  if (hidden.length) console.log(`Page ${pageNo}: ${hidden.length} deals from the API not shown (${hidden.map(d => d.status).join(', ')})`);
  return shown;
}

/** Pairs of neighbouring deals that are in the wrong order for this option and direction. */
function outOfOrder(deals, option, sortOrder) {
  const show = option.show ?? option.value;
  const problems = [];
  for (let i = 0; i + 1 < deals.length; i++) {
    const diff = option.compare(option.value(deals[i]), option.value(deals[i + 1]));
    if (sortOrder === 'desc' ? diff < 0 : diff > 0) problems.push(`"${show(deals[i])}" is above "${show(deals[i + 1])}"`);
  }
  return problems;
}

/** Sets the direction with the arrow button (it toggles) unless it already is. */
async function setDirection(page, sortOrder) {
  if (await directionButton(page).getAttribute('title') !== directionTitle(sortOrder)) await directionButton(page).click();
  await expect(directionButton(page), `Direction button should say "${directionTitle(sortOrder)}"`)
    .toHaveAttribute('title', directionTitle(sortOrder));
}

/** Checks page 1 is in order, then that page 2 is in order and carries on where page 1 stopped; ends back on page 1. */
async function checkOrder(page, pages, option, sortOrder, total) {
  const label = `"${option.name}" ${sortOrder === 'desc' ? 'descending' : 'ascending'}`;
  const show = option.show ?? option.value;
  await expect(sortDropdown(page)).toHaveText(option.name);
  await expect(pager(page)).toHaveText(/^Page 1 of \d+$/);
  await expect(dealCounter(page), 'Sorting should not change the number of deals').toHaveText(`${total} deals`);

  const first = await shownDeals(page, pages, 1);
  expect(first.length, 'Need at least 2 deals to check the order').toBeGreaterThan(1);
  expect.soft(outOfOrder(first, option, sortOrder), `${label}: page 1 should be in order`).toEqual([]);
  console.log(`${label}, page 1: ${first.slice(0, 3).map(d => show(d)).join(', ')}, ... ${show(first.at(-1))}`);
  // Screenshot the end of page 1, so it can be compared with the start of page 2
  await dealRows(page).last().scrollIntoViewIfNeeded();
  await page.screenshot({ path: `screenshots/Deal/DealSortBy-${option.name.replace(/\s+/g, '')}-${sortOrder}.png` });

  if (await nextPage(page).isEnabled()) {
    await nextPage(page).click();
    await expect(pager(page)).toHaveText(/^Page 2 of \d+$/);
    await expect(sortDropdown(page), 'Sort option should stay on page 2').toHaveText(option.name);
    await expect(directionButton(page), 'Sort direction should stay on page 2').toHaveAttribute('title', directionTitle(sortOrder));
    const second = await shownDeals(page, pages, 2);
    expect.soft(outOfOrder(second, option, sortOrder), `${label}: page 2 should be in order`).toEqual([]);
    expect.soft(outOfOrder([first.at(-1), second[0]], option, sortOrder),
      `${label}: page 2 should carry on where page 1 stopped (the whole list is sorted, not each page on its own)`).toEqual([]);
    console.log(`${label}, page 1 ends with "${show(first.at(-1))}", page 2 starts with "${show(second[0])}"`);
    await page.screenshot({ path: `screenshots/Deal/DealSortBy-${option.name.replace(/\s+/g, '')}-${sortOrder}-page2.png` });
    await previousPage(page).click();
    await expect(pager(page)).toHaveText(/^Page 1 of \d+$/);
  } else {
    console.log(`${label}: only one page, so the next page is not checked`);
  }
}

test('Sort the Deals list with each Sort by option', async ({ page }) => {
  test.setTimeout(420000);
  const pages = watchPages(page);
  let total;

  await test.step('List View opens sorted by "Deal created", newest first', async () => {
    await loginStaging(page);
    await page.getByRole('button', { name: 'List View', exact: true }).click({ timeout: 30000 });
    await expect(page.getByRole('columnheader', { name: 'TITLE' })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Loading deals...')).toBeHidden({ timeout: 30000 });
    await expect(sortDropdown(page)).toHaveText('Deal created');
    await expect(directionButton(page)).toHaveAttribute('title', directionTitle('desc'));
    await expect(directionButton(page).locator('svg.lucide-arrow-down'), 'Direction button should show the down arrow').toBeVisible();
    const first = await shownDeals(page, pages, 1);
    total = pages.get(1).pagination.total;
    await expect(dealCounter(page)).toHaveText(`${total} deals`);
    expect.soft(outOfOrder(first, DEFAULT_OPTION, 'desc'), 'Deals should open newest first').toEqual([]);
  });

  await test.step('Sort by dropdown lists every option', async () => {
    await sortDropdown(page).click();
    await expect(page.getByRole('option')).toHaveText(SORT_OPTIONS.map(o => o.name));
    await page.screenshot({ path: 'screenshots/Deal/DealSortBy-options.png' });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('option')).toHaveCount(0);
  });

  for (const option of SORT_OPTIONS) {
    await test.step(`Sort by "${option.name}"`, async () => {
      await sortDropdown(page).click();
      await page.getByRole('option', { name: option.name, exact: true }).click();
      await expect(page.getByRole('option')).toHaveCount(0);

      // The arrow button switches between descending and ascending
      await setDirection(page, 'desc');
      await checkOrder(page, pages, option, 'desc', total);
      await setDirection(page, 'asc');
      await expect(directionButton(page).locator('svg.lucide-arrow-up'), 'Direction button should show the up arrow').toBeVisible();
      await checkOrder(page, pages, option, 'asc', total);
      await setDirection(page, 'desc');
    });
  }
});
