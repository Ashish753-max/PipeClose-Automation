// tests/common/prospects.js
// Shared flow for the Prospects filter scripts (tests/Prospects/*Filter.spec.js).
// Only searches: nothing is saved or enriched, so no credits are used.
const { expect } = require('@playwright/test');
const { loginStaging } = require('./createDeal');

const isSearch = r => r.url().includes('/api/integrations/lead-data/search') && r.method() === 'POST';
const PAGE_SIZE = 25;

function prospectsPage(page) {
  const main = page.getByRole('main').first();
  const results = main.getByRole('main');
  return {
    main,
    results,
    panel: page.getByRole('complementary').filter({ has: page.getByRole('heading', { name: 'Filters' }) }),
    rows: results.getByRole('row').filter({ has: page.getByRole('checkbox', { name: /^Select (?!all)/ }) }),
    matches: main.locator('strong').filter({ hasText: /^[\d,]+$/ }).first(), // "5,699,162" matches
  };
}

/**
 * Logs in and opens Prospects from the sidebar with the Filters panel showing.
 * @returns {Promise<{ total: number, leads: object[] }>} the unfiltered search
 */
async function openProspects(page) {
  await loginStaging(page);
  const all = await search(page, () => page.locator('a[href="/prospects"]').first().click(), {});
  const { main, panel } = prospectsPage(page);
  await expect(main.getByRole('button', { name: /^(Show|Hide) filters$/ })).toBeVisible();
  if (!(await panel.isVisible())) await main.getByRole('button', { name: 'Show filters' }).click();
  await expect(panel).toBeVisible();
  return all;
}

/**
 * Runs a filter change, checks the search it sends has exactly the expected filters and that the page shows
 * the results: the matches count and the first page of people, in the order the search returned them.
 * @param {() => Promise<unknown>} action
 * @param {object} expected filters besides perPage, e.g. { locations: { include: ['Germany'] } }
 * @returns {Promise<{ total: number, leads: object[] }>}
 */
async function search(page, action, expected) {
  // Wait for the request the action sends (not a response, which could be an earlier search still arriving)
  const [request] = await Promise.all([page.waitForRequest(isSearch, { timeout: 30000 }), action()]);
  const { perPage, ...filters } = request.postDataJSON().params;
  expect(filters, 'Search should send the chosen filters').toEqual(expected);
  const response = await request.response();
  expect(response.status(), `Search returned ${response.status()}`).toBe(200);
  const { totalCount: total, leads } = (await response.json()).data;
  await expect(prospectsPage(page).matches, 'Matches count should show the search total')
    .toHaveText(total.toLocaleString('en-US'));
  await expectRows(page, leads);
  console.log(`${JSON.stringify(expected)}: ${total.toLocaleString('en-US')} matches`);
  return { total, leads };
}

/** The table lists these people in order on the first `pages` pages (25 a page), then goes back to page 1. */
async function expectRows(page, leads, pages = 1) {
  const { results, rows } = prospectsPage(page);
  for (let p = 0; p < pages; p++) {
    const shown = leads.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE);
    if (p) await results.getByRole('button', { name: 'Next page' }).click();
    await expect(results.getByText(`${p * PAGE_SIZE + 1}–${p * PAGE_SIZE + shown.length} of ${leads.length}`)).toBeVisible();
    await expect(rows).toHaveCount(shown.length);
    for (const [i, lead] of shown.entries()) {
      await expect(rows.nth(i).getByRole('checkbox')).toHaveAccessibleName(`Select ${lead.fullName}`);
      if (lead.title) await expect(rows.nth(i)).toContainText(lead.title);
    }
  }
  for (let p = 1; p < pages; p++) await results.getByRole('button', { name: 'Previous page' }).click();
}

/** Opens a filter section if it is closed. Returns its field and the button that opens its dropdown. */
async function openSection(page, section, placeholder) {
  const { panel } = prospectsPage(page);
  const button = panel.getByRole('button', { name: new RegExp(`^${section}( \\d+)?$`) });
  if (await button.getAttribute('aria-expanded') !== 'true') await button.click();
  const field = panel.getByPlaceholder(placeholder);
  await expect(field).toBeVisible();
  return { field, showOptions: field.locator('xpath=..').getByRole('button', { name: 'Show options' }) };
}

// "Include" button of one option in an open dropdown (the option's row holds its name and the button)
const option = (page, name) => prospectsPage(page).panel.locator('div')
  .filter({ has: page.getByText(name, { exact: true }) })
  .filter({ has: page.getByRole('button', { name: 'Include', exact: true }) })
  .last()
  .getByRole('button', { name: 'Include', exact: true });

const openOptions = page => prospectsPage(page).panel.getByRole('button', { name: 'Include', exact: true });

/** Closes the dropdown, which stays open over the sections below after an option is picked. */
async function closeOptions(page, field) {
  if (await openOptions(page).count()) await field.press('Escape');
  await expect(openOptions(page)).toHaveCount(0);
}

/** The section heading counts the chosen values ("Location 2") and each one shows with its Remove button. */
async function expectChosen(page, section, values) {
  const { panel } = prospectsPage(page);
  const label = values.length ? `${section} ${values.length}` : section;
  await expect(panel.getByRole('button', { name: label, exact: true }), `${section} should count ${values.length} chosen`).toBeVisible();
  for (const value of values) await expect(panel.getByRole('button', { name: `Remove ${value}`, exact: true })).toBeVisible();
}

const remove = (page, value) => () => prospectsPage(page).panel.getByRole('button', { name: `Remove ${value}`, exact: true }).click();

// Titles compared word for word, ignoring case, punctuation and a plural "s"
// (the provider returns "Sale Manager" for "Sales Manager")
const words = text => ` ${(text || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean).map(w => w.replace(/s$/, '')).join(' ')} `;

/** Every person returned has one of the wanted job titles. Soft, so every wrong title is listed. */
function expectTitles(leads, wanted) {
  const wrong = leads.filter(lead => !wanted.some(title => words(lead.title).includes(words(title))))
    .map(lead => `${lead.fullName}: ${lead.title}`);
  expect.soft(wrong, `Every person should have the title ${wanted.join(' or ')}`).toEqual([]);
}

/** Live data changes a little between searches, so totals from different searches are compared within 0.1%. */
function expectAbout(actual, expected, message) {
  expect(Math.abs(actual - expected), `${message} (${actual} vs ${expected})`).toBeLessThanOrEqual(Math.ceil(expected * 0.001));
}

module.exports = {
  prospectsPage, openProspects, search, expectRows, openSection, option, openOptions, closeOptions,
  expectChosen, remove, expectTitles, expectAbout,
};
