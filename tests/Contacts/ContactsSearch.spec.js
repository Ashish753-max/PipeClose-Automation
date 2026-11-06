const { test, expect } = require('@playwright/test');
const { loginStaging } = require('../common/createDeal');

// Search box of the Contacts module (People and Organizations lists). Only reads data.

const BASE_URL = 'https://staging.pipeclose.com';
const PAGE_SIZE = 30;
const LISTS = {
  people: {
    heading: 'People', api: '/api/persons/?', key: 'persons', icon: 'lucide-users', empty: 'No people found',
    name: p => clean([p.firstName, p.lastName].filter(Boolean).join(' ')),
    // People are searched by name only (NAME is the first column)
    matches: ([name], term) => has(name, term),
  },
  organizations: {
    heading: 'Organizations', api: '/api/organisations/?', key: 'organizations', icon: 'lucide-building', empty: 'No organizations found',
    name: o => clean(o.name),
    // Organizations are searched by name, industry and website (the first three columns)
    matches: ([name, industry, website], term) => [name, industry, website].some(text => has(text, term)),
  },
};

const clean = text => String(text ?? '').replace(/\s+/g, ' ').trim();
const has = (text, term) => clean(text).toLowerCase().includes(term.toLowerCase());

const searchBox = page => page.getByPlaceholder('Search...');
const clearButton = page => searchBox(page).locator('xpath=following-sibling::button[1]'); // the × has no label
const rows = page => page.getByRole('row').filter({ has: page.getByRole('cell') });
const footer = page => page.getByText(/^Page \d+ of \d+ · \d+ total$/);
// People / Organizations buttons in the Contacts sidebar: icons only (the names show as tooltips)
const listButton = (page, list) => page.getByRole('main').locator(`button:has(svg.${list.icon})`);

/** Cell texts of the shown rows, without the checkbox column. */
const readRows = page => rows(page).evaluateAll(rs =>
  rs.map(r => [...r.querySelectorAll('td')].slice(1).map(td => td.innerText.replace(/\s+/g, ' ').trim())));

/** Runs the action and returns what the list API sent back for this search text and offset. */
async function loadList(page, list, action, { q = '', offset = 0 } = {}, timeout = 30000) {
  const [response] = await Promise.all([
    page.waitForResponse(r => {
      if (!r.url().includes(list.api)) return false;
      // limit=30: other parts of the app also load people (e.g. 100 at a time), which are not this list
      const query = new URL(r.url()).searchParams;
      return query.get('limit') === String(PAGE_SIZE) && (query.get('q') ?? '') === q && Number(query.get('offset') ?? 0) === offset;
    }, { timeout }),
    action(),
  ]);
  expect(response.ok(), `${list.heading} API returned ${response.status()}`).toBeTruthy();
  const data = (await response.json()).data;
  const items = data[list.key];
  // The table should show exactly these records, in this order
  await expect.poll(async () => (await readRows(page)).map(cells => cells[0]),
    { message: `${list.heading} table should show what the API returned for "${q}"` }).toEqual(items.map(list.name));
  return { items, count: data.count };
}

/** Footer is only shown when there is more than one page. */
async function expectFooter(page, count, pageNo = 1) {
  if (count > PAGE_SIZE) await expect(footer(page)).toHaveText(`Page ${pageNo} of ${Math.ceil(count / PAGE_SIZE)} · ${count} total`);
  else await expect(footer(page), 'Footer should only show when there is more than one page').toBeHidden();
}

/**
 * Searches the term and checks every row matches it and the footer fits the number found.
 * When `expected` is given and everything fits on one page, that record must be among the results.
 */
async function expectSearch(page, list, term, expected) {
  const { items, count } = await loadList(page, list, () => searchBox(page).fill(term), { q: term });
  expect(count, `Searching "${term}" should find something`).toBeGreaterThan(0);
  await expectFooter(page, count);
  const wrong = (await readRows(page)).filter(cells => !list.matches(cells, term));
  expect(wrong, `Every ${list.heading} row should match "${term}"`).toEqual([]);
  if (expected && count <= PAGE_SIZE) {
    expect(items.map(list.name), `"${expected}" should be found by "${term}"`).toContain(expected);
  }
  console.log(`${list.heading} search "${term}": ${count} found`);
  return { items, count };
}

/** Logs in and opens Contacts; returns the first page of People it loads. */
async function openContacts(page) {
  const first = await loadList(page, LISTS.people, async () => {
    await loginStaging(page);
    await page.locator('a[href="/contacts"]').first().click({ timeout: 30000 });
  }, {}, 90000);
  await expect(page.getByRole('heading', { name: 'People', exact: true })).toBeVisible();
  return first;
}

/** Search box starts empty with no × button, and the footer counts every record. */
async function expectFullList(page, list, total) {
  await expect(searchBox(page)).toHaveValue('');
  await expect(clearButton(page), '× should only show once something is typed').toBeHidden();
  await expect(rows(page)).toHaveCount(Math.min(total, PAGE_SIZE));
  await expectFooter(page, total);
}

/** A search with more than one page of results: Next shows page 2 of the same search. */
async function expectSearchPaging(page, list, term) {
  const { count } = await expectSearch(page, list, term);
  if (count <= PAGE_SIZE) {
    console.log(`${list.heading} search "${term}": only ${count} found, so paging is not checked`);
    return;
  }
  const query = { q: term, offset: PAGE_SIZE };
  await loadList(page, list, () => page.getByRole('button', { name: 'Next', exact: true }).click(), query);
  await expectFooter(page, count, 2);
  await expect(searchBox(page), 'Search should stay while paging').toHaveValue(term);
  const wrong = (await readRows(page)).filter(cells => !list.matches(cells, term));
  expect(wrong, `Every row on page 2 should match "${term}"`).toEqual([]);
  console.log(`${list.heading} search "${term}": page 2 also matches`);
  await loadList(page, list, () => page.getByRole('button', { name: 'Previous', exact: true }).click(), { q: term });
}

/** No match shows the empty message; × then clears the search and shows the full list again. */
async function expectNoMatchAndClear(page, list, total) {
  const term = `NoSuchContact${Date.now()}`;
  const { count } = await loadList(page, list, () => searchBox(page).fill(term), { q: term });
  expect(count, `Searching "${term}" should find nothing`).toBe(0);
  await expect(page.getByText(list.empty, { exact: true })).toBeVisible();
  await expect(page.getByText('Try adjusting your search query', { exact: true })).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
  await expect(footer(page)).toBeHidden();
  await page.screenshot({ path: `screenshots/Contacts/${list.heading}Search-no-match.png` });

  await expect(clearButton(page), '× should show while searching').toBeVisible();
  await loadList(page, list, () => clearButton(page).click(), { q: '' });
  await expect(page.getByText(list.empty, { exact: true })).toBeHidden();
  await expectFullList(page, list, total);
  console.log(`${list.heading}: × cleared the search, ${total} listed again`);
}

test("Search People in Contacts", async ({ page }) => {
  test.setTimeout(240000);
  const list = LISTS.people;
  const { items, count: total } = await openContacts(page);

  // Someone from the list with a first name, last name and email, e.g. "Dev Bisht"
  const person = items.find(p => /^[a-z][\w.-]*$/i.test(p.firstName ?? '') && /^[a-z][\w.-]*$/i.test(p.lastName ?? '') && p.emails?.[0]?.email);
  expect(person, 'Need a person with a first name, last name and email on the first page').toBeTruthy();
  const name = list.name(person);
  const email = person.emails[0].email;
  console.log(`Searching for person ${person.id} "${name}" (${email}); ${total} people in all`);

  await test.step('People list shows every person', async () => {
    await expectFullList(page, list, total);
  });

  await test.step('Search by full name', async () => {
    await expectSearch(page, list, name, name);
    await expect(clearButton(page), '× should show while searching').toBeVisible();
    await page.screenshot({ path: 'screenshots/Contacts/PeopleSearch-full-name.png' });
  });

  await test.step('Search by last name, in lower case', async () => {
    await expectSearch(page, list, person.lastName.toLowerCase(), name);
  });

  await test.step('Search by part of the name, in upper case', async () => {
    await expectSearch(page, list, name.slice(1, -1).toUpperCase(), name);
  });

  await test.step('Search by email', async () => {
    // Soft check: the rest of the test still runs if the email is not found
    const { items: found } = await loadList(page, list, () => searchBox(page).fill(email), { q: email });
    expect.soft(found.map(p => p.id), `Searching the email "${email}", shown in the EMAIL column, should find ${name}`).toContain(person.id);
    await page.screenshot({ path: 'screenshots/Contacts/PeopleSearch-email.png' });
  });

  await test.step('Search with more than one page of results', async () => {
    await expectSearchPaging(page, list, 'a');
  });

  await test.step('No match, then clear the search', async () => {
    await expectNoMatchAndClear(page, list, total);
  });
});

test("Search Organizations in Contacts", async ({ page }) => {
  test.setTimeout(240000);
  const list = LISTS.organizations;
  await openContacts(page);
  const { items, count: total } = await loadList(page, list, () => listButton(page, list).click());
  await expect(page.getByRole('heading', { name: 'Organizations', exact: true })).toBeVisible();

  // An organization with an industry and a website. The newest ones (first pages) are often test leftovers
  // without them, so look through the pages the same way the list loads them.
  const isComplete = o => clean(o.name).length > 3 && o.industry && o.website;
  let org = items.find(isComplete);
  for (let offset = PAGE_SIZE; !org && offset < total; offset += PAGE_SIZE) {
    const response = await page.request.get(`${BASE_URL}${list.api}limit=${PAGE_SIZE}&offset=${offset}`);
    org = (await response.json()).data.organizations.find(isComplete);
  }
  expect(org, 'Need an organization with an industry and a website').toBeTruthy();
  const name = list.name(org);
  const domain = org.website.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/.*$/, ''); // "https://www.appnox.ai/" -> "appnox.ai"
  console.log(`Searching for organization ${org.id} "${name}" (${org.industry}, ${org.website}); ${total} organizations in all`);

  await test.step('Organizations list shows every organization', async () => {
    await expectFullList(page, list, total);
  });

  await test.step('Search by name', async () => {
    await expectSearch(page, list, name, name);
    await expect(clearButton(page), '× should show while searching').toBeVisible();
    await page.screenshot({ path: 'screenshots/Contacts/OrganizationsSearch-name.png' });
  });

  await test.step('Search by part of the name, in lower case', async () => {
    await expectSearch(page, list, name.slice(1, -1).toLowerCase(), name);
  });

  await test.step('Search by website', async () => {
    await expectSearch(page, list, domain, name);
    await page.screenshot({ path: 'screenshots/Contacts/OrganizationsSearch-website.png' });
  });

  await test.step('Search by industry, in upper case', async () => {
    await expectSearch(page, list, org.industry.toUpperCase(), name);
  });

  await test.step('Search with more than one page of results', async () => {
    await expectSearchPaging(page, list, 'a');
  });

  await test.step('No match, then clear the search', async () => {
    await expectNoMatchAndClear(page, list, total);
  });

  await test.step('Switching lists keeps the search box and the list in step', async () => {
    await expectSearch(page, list, name, name);
    // Whatever the box shows after switching, the list must be searched with exactly that
    for (const other of [LISTS.people, list]) {
      const [response] = await Promise.all([
        page.waitForResponse(r => r.url().includes(other.api) && new URL(r.url()).searchParams.get('limit') === String(PAGE_SIZE),
          { timeout: 30000 }),
        listButton(page, other).click(),
      ]);
      await expect(page.getByRole('heading', { name: other.heading, exact: true })).toBeVisible();
      const shownText = await searchBox(page).inputValue();
      expect(new URL(response.url()).searchParams.get('q') ?? '', `${other.heading} should be searched with the text in the box`).toBe(shownText);
      console.log(`Switched to ${other.heading}: box "${shownText}", list searched with it`);
    }
  });
});
