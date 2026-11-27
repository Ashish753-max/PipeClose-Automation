// tests/common/leadList.js
// Shared helpers for the Leads list filter and pagination scripts (tests/Lead/LeadFilters.spec.js, tests/Lead/LeadPagination.spec.js)
const { expect } = require('@playwright/test');

const BASE_URL = 'https://staging.pipeclose.com';
const clean = text => String(text ?? '').replace(/\s+/g, ' ').trim();

/**
 * Waits for the Leads list request (GET /api/leads/get?...) whose query passes `check`.
 * Start it before the click that loads the list: `const [res] = await Promise.all([leadsResponse(page, q => ...), button.click()])`.
 * @param {import('@playwright/test').Page} page
 * @param {(query: URLSearchParams) => boolean} [check]
 */
const leadsResponse = (page, check = () => true) => page.waitForResponse(r =>
  r.url().includes('/api/leads/get?') && r.request().method() === 'GET' && check(new URL(r.url()).searchParams),
{ timeout: 30000 });

/** The leads and pagination ({ total, page, limit, totalPages }) of a Leads list response. */
async function readLeads(response) {
  expect(response.ok(), `Leads list API returned ${response.status()}`).toBeTruthy();
  const { leads, pagination } = (await response.json()).data;
  return { leads, pagination, query: new URL(response.url()).searchParams };
}

/** Clicks `target` and returns the Leads list it loaded (the request must pass `check`). */
async function loadLeads(page, target, check) {
  const [response] = await Promise.all([leadsResponse(page, check), target.click()]);
  return readLeads(response);
}

// Table rows with data cells (the header row only has column headers)
const leadRows = page => page.getByRole('row').filter({ has: page.getByRole('cell') });

/** Contact names shown in the table, top to bottom (the Contact column is the 2nd cell, after the checkbox). */
const shownContacts = page => leadRows(page).evaluateAll(rows => rows.map(r => r.cells[1]?.innerText.replace(/\s+/g, ' ').trim()));

/** Contact name the table shows for an API lead. */
const contactOf = lead => clean(lead.personName ?? [lead.person?.firstName, lead.person?.lastName].join(' '));

/** Waits until the table shows exactly these leads, in this order. */
async function expectTableShows(page, leads, message) {
  await expect.poll(() => shownContacts(page), { message, timeout: 15000 }).toEqual(leads.map(contactOf));
}

// "29 leads" above the table ("1 lead" when there is one)
const leadCounter = page => page.getByText(/^\d+ leads?$/);
const counterText = total => `${total} ${total === 1 ? 'lead' : 'leads'}`;

// Pagination footer: "Rows per page [20]   Page 1 of 2  [<] [>]" (the two arrow buttons have no name)
const rowsPerPage = page => page.getByText('Rows per page', { exact: true }).locator('xpath=following-sibling::*[1]');
const pagerText = page => page.getByText(/^Page \d+ of \d+$/);
const previousPage = page => pagerText(page).locator('xpath=following-sibling::*').getByRole('button').first();
const nextPage = page => pagerText(page).locator('xpath=following-sibling::*').getByRole('button').last();

/** Text the pager shows for this page of a list (the app shows "Page 1 of 1" for an empty list too). */
const pageLabel = (pageNo, totalPages) => `Page ${pageNo} of ${Math.max(totalPages, 1)}`;

module.exports = {
  BASE_URL, leadsResponse, readLeads, loadLeads, leadRows, shownContacts, contactOf, expectTableShows,
  leadCounter, counterText, rowsPerPage, pagerText, previousPage, nextPage, pageLabel,
};
