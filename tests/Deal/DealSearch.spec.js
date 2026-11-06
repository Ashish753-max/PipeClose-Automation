const { test, expect } = require('@playwright/test');
const { loginStaging, addDeal } = require('../common/createDeal');

const BASE_URL = 'https://staging.pipeclose.com';

// The Deals page has no search box of its own (Leads has "Search leads.."), so deals are searched
// from the header search. Its results are grouped: "DEALS (2)", "PERSONS (1)", "ORGANIZATIONS (1)", ...
const searchBox = page => page.getByPlaceholder('Search deals, leads, contacts, organizations...');
const dropdown = page => page.locator('.global-search-dropdown');
const clearButton = page => page.locator('.global-search-clear');
const resultGroup = (page, name) => page.locator('.global-search-group')
  .filter({ has: page.locator('.global-search-header', { hasText: new RegExp(`^${name} \\(\\d+\\)$`, 'i') }) });
const dealResults = page => resultGroup(page, 'Deals').locator('.global-search-result');

/** Types the term in the header search and returns what the search API sent back for it. */
async function search(page, term) {
  const [response] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/deals/?') && new URL(r.url()).searchParams.get('search') === term,
      { timeout: 30000 }),
    searchBox(page).fill(term),
  ]);
  expect(response.ok(), `Search API returned ${response.status()}`).toBeTruthy();
  return (await response.json()).data;
}

/** Searches the term and checks that the Deals results show only the given deal. */
async function expectOnlyDeal(page, term, deal, what) {
  const data = await search(page, term);
  expect(data.deals.map(d => d.id), `Searching the ${what} "${term}" should find only the new deal`).toEqual([deal.id]);
  await expect(dealResults(page)).toHaveCount(1);
  await expect(resultGroup(page, 'Deals').locator('.global-search-header'), 'Group header should count 1 deal').toHaveText(/\(1\)$/);
  const result = dealResults(page).first();
  await expect(result.locator('.global-search-result-title')).toHaveText(deal.title);
  await expect(result.locator('.global-search-type-badge')).toHaveText('Deal');
  await expect(result.locator('.global-search-result-value')).toHaveText('$1,500');
  await expect(result.locator('.global-search-status')).toHaveText('OPEN');
  console.log(`Search by ${what} "${term}": found "${deal.title}"`);
}

// The test deal, archived after the test (also when it fails or times out) so runs don't fill up the Deals list
let testDeal;
test.afterEach(async ({ page }) => {
  if (!testDeal) return;
  const response = await page.request.post(`${BASE_URL}/api/deals/archive`, { data: { dealIds: [testDeal.id] } }).catch(e => e);
  if (response.ok?.()) console.log(`Cleanup: archived deal ${testDeal.id}`);
  else console.warn(`Cleanup: could not archive deal ${testDeal.id} "${testDeal.title}": ${response.status?.() ?? response.message}`);
  testDeal = undefined;
});

test("Search deals from the Deals list", async ({ page }) => {
  test.setTimeout(240000);
  await loginStaging(page);
  await page.getByRole('button', { name: 'Pipeline View', exact: true }).click({ timeout: 30000 });

  // A fresh deal with unique names, so every search has exactly one known result.
  // "DealSearch Test123456" is saved as first name "DealSearch", last name "Test123456".
  const stamp = Date.now().toString().slice(-6);
  const person = `DealSearch Test${stamp}`;
  const organization = `DealSearchOrg${stamp}`;
  const created = page.waitForResponse(r => r.url().includes('/api/deals/create') && r.request().method() === 'POST');
  await addDeal(page, {
    person, organization, value: '1500', phone: '9876543210',
    email: 'deal.search@gmail.com', screenshot: 'Deal/DealSearch-created.png',
  }, { checkSuccessMessage: false });
  const { deal } = (await (await created).json()).data;
  testDeal = deal;
  const email = deal.emails[0].value;
  console.log(`Created deal ${deal.id} "${deal.title}" (${email})`);

  await test.step('New deal is in the Deals list view', async () => {
    await page.getByRole('button', { name: 'List View', exact: true }).click();
    await expect(page.getByRole('columnheader', { name: 'Title' })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Loading deals...')).toBeHidden({ timeout: 30000 });
    await expect(page.getByRole('row').filter({ hasText: deal.title }), 'New deal should be in the list').toHaveCount(1);
    await expect(searchBox(page)).toHaveValue('');
    await expect(clearButton(page), 'Clear button should only show once something is typed').toBeHidden();
  });

  await test.step('Search by deal title', async () => {
    await expectOnlyDeal(page, deal.title, deal, 'deal title');
    await expect(clearButton(page), 'Clear button should show while searching').toBeVisible();
    await page.screenshot({ path: 'screenshots/Deal/DealSearch-1-title.png' });
  });

  await test.step('Search by deal title, in lower case', async () => {
    await expectOnlyDeal(page, deal.title.toLowerCase(), deal, 'deal title');
  });

  await test.step('Search by contact person', async () => {
    await expectOnlyDeal(page, `Test${stamp}`, deal, 'contact person');
    await page.screenshot({ path: 'screenshots/Deal/DealSearch-2-contact.png' });
  });

  await test.step('Search by organization, in upper case', async () => {
    await expectOnlyDeal(page, organization.toUpperCase(), deal, 'organization');
    await expect(resultGroup(page, 'Organizations').locator('.global-search-result-title'),
      'The organization should be listed too').toHaveText([organization]);
    await page.screenshot({ path: 'screenshots/Deal/DealSearch-3-organization.png' });
  });

  await test.step('Search by part of the name', async () => {
    await expectOnlyDeal(page, stamp, deal, 'part of the name');
  });

  await test.step('Search by contact email', async () => {
    // Soft check: the rest of the test still runs if the email is not found
    const data = await search(page, email);
    expect.soft(data.deals.map(d => d.id), `Searching the deal's email "${email}" should find the deal`).toEqual([deal.id]);
    await page.screenshot({ path: 'screenshots/Deal/DealSearch-4-email.png' });
  });

  await test.step('Search with no match shows "No results found"', async () => {
    const term = `NoSuchDeal${stamp}`;
    const data = await search(page, term);
    expect(data.deals, `Searching "${term}" should find no deals`).toEqual([]);
    await expect(dropdown(page).locator('.global-search-empty')).toContainText('No results found');
    await expect(dropdown(page).locator('.global-search-empty')).toContainText('Try searching with different keywords');
    await expect(page.locator('.global-search-result')).toHaveCount(0);
    await page.screenshot({ path: 'screenshots/Deal/DealSearch-5-no-match.png' });
  });

  await test.step('Clear search empties the box and the results', async () => {
    await clearButton(page).click();
    await expect(searchBox(page)).toHaveValue('');
    await expect(searchBox(page), 'Search box should keep focus after clearing').toBeFocused();
    await expect(clearButton(page)).toBeHidden();
    await expect(page.locator('.global-search-result')).toHaveCount(0);
    await expect(dropdown(page)).toContainText('Start typing to search');
    await page.screenshot({ path: 'screenshots/Deal/DealSearch-6-cleared.png' });
  });

  await test.step('Escape closes the results and keeps the text', async () => {
    await expectOnlyDeal(page, deal.title, deal, 'deal title');
    await page.keyboard.press('Escape');
    await expect(dropdown(page)).toBeHidden();
    await expect(searchBox(page)).toHaveValue(deal.title);
  });

  await test.step('Clicking the result opens the deal', async () => {
    // The box still holds the title, so clear it first: typing the same text does not search again
    await clearButton(page).click();
    await expectOnlyDeal(page, deal.title, deal, 'deal title');
    await dealResults(page).first().click();
    await expect(page).toHaveURL(`${BASE_URL}/deals/${deal.id}`);
    // Any case: the deal page re-capitalises each word of the title ("DealSearch" shows as "Dealsearch")
    const title = new RegExp(`^${deal.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible({ timeout: 30000 });
    await expect(dropdown(page), 'Results should close after opening the deal').toBeHidden();
    await page.screenshot({ path: 'screenshots/Deal/DealSearch-7-opened.png' });
  });
});
