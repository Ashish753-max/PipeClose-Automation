// tests/common/globalSearch.js
// Shared flow for the Global Search scripts (tests/Global Search/*.spec.js)
const { expect } = require('@playwright/test');
const { loginStaging } = require('./createDeal');

/**
 * Searches from the header search bar and verifies the results.
 * @param {import('@playwright/test').Page} page
 * @param {string} query text to search
 * @param {'Lead'|'Deal'|'Organization'} type type the searched record must be shown as
 * @param {string} screenshot file name in screenshots/
 */
async function globalSearch(page, query, type, screenshot) {
  await loginStaging(page);

  // Search from the header
  const searchBox = page.getByPlaceholder('Search deals, leads, contacts, organizations...');
  await searchBox.waitFor({ state: 'visible', timeout: 30000 });
  await searchBox.fill(query);

  const dropdown = page.locator('.global-search-dropdown');
  await expect(dropdown, 'Search results dropdown should open').toBeVisible({ timeout: 15000 });
  const results = dropdown.locator('.global-search-result');
  await expect(results.first()).toBeVisible({ timeout: 15000 });

  // Read every result as { type, title }
  const shown = await results.evaluateAll(rows => rows.map(r => ({
    type: r.querySelector('.global-search-type-badge')?.textContent.trim(),
    title: r.querySelector('.global-search-result-title')?.textContent.trim(),
  })));
  console.log(`Search "${query}" -> ${shown.length} results:`);
  shown.forEach(r => console.log(`  ${r.type}: ${r.title}`));
  await page.screenshot({ path: `screenshots/${screenshot}` });

  // The searched record must be shown with the right type
  const found = shown.some(r => r.type === type && r.title.toLowerCase() === query.toLowerCase());
  expect(found, `${type} "${query}" should be in the search results`).toBeTruthy();

  // Group headers ("Deals (3)") must match the number of results under them
  const groups = dropdown.locator('.global-search-group');
  for (let i = 0; i < await groups.count(); i++) {
    const header = (await groups.nth(i).locator('.global-search-header').innerText()).trim();
    const count = await groups.nth(i).locator('.global-search-result').count();
    expect(header, `Group header should match its result count`).toMatch(new RegExp(`\\(${count}\\)$`));
  }

  // No extra results: every title must contain the searched text
  const extra = shown.filter(r => !r.title.toLowerCase().includes(query.toLowerCase()));
  expect(extra, `Only results matching "${query}" should be shown`).toEqual([]);
}

module.exports = globalSearch;
