const { test, expect } = require('@playwright/test');
const { openLeads } = require('../common/createLead');
const {
  leadsResponse, readLeads, loadLeads, leadRows, expectTableShows,
  leadCounter, counterText, rowsPerPage, pagerText, previousPage, nextPage, pageLabel,
} = require('../common/leadList');

// Pagination of the Leads List View: the "Rows per page" menu and the previous / next page buttons.
// What each page must show is read from the API the page calls. Screenshots are saved in screenshots/Lead/.
// Run this file on its own: other Lead scripts adding or removing leads alongside would shift the pages.

const ROWS_PER_PAGE = ['10', '20', '50', '100'];
const DEFAULT_ROWS = '20';

/** Opens the Leads list and returns the first page it loaded with the default settings. */
async function openFirstPage(page) {
  const first = leadsResponse(page, q => q.get('page') === '1' && !q.has('category') && !q.has('search') && !q.has('folderId'));
  await openLeads(page);
  return readLeads(await first);
}

/** Picks a "Rows per page" option and returns the list it loaded. */
async function pickRowsPerPage(page, rows) {
  await rowsPerPage(page).click();
  return loadLeads(page, page.getByRole('option', { name: rows, exact: true }), q => q.get('limit') === rows);
}

test.describe('Lead pagination', () => {
  test('Rows per page: each option shows that many leads per page', async ({ page }) => {
    test.setTimeout(180000);
    const first = await openFirstPage(page);
    const total = first.pagination.total;

    await test.step('20 rows per page on page 1 by default', async () => {
      await expect(rowsPerPage(page)).toHaveText(DEFAULT_ROWS);
      expect(first.query.get('limit')).toBe(DEFAULT_ROWS);
      await expect(pagerText(page)).toHaveText(pageLabel(1, first.pagination.totalPages));
      await expect(previousPage(page), 'Previous should be disabled on page 1').toBeDisabled();
      await expect(leadRows(page)).toHaveCount(Math.min(total, 20));
      console.log(`${total} leads, ${first.pagination.totalPages} page(s) of ${DEFAULT_ROWS}`);
    });

    await test.step('Rows per page offers 10, 20, 50 and 100', async () => {
      await rowsPerPage(page).click();
      await expect(page.getByRole('option')).toHaveText(ROWS_PER_PAGE);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('option')).toHaveCount(0);
    });

    for (const rows of ['10', '50', '100', '20']) {
      await test.step(`${rows} rows per page`, async () => {
        const { leads, pagination, query } = await pickRowsPerPage(page, rows);
        const expectedPages = Math.ceil(total / Number(rows));
        expect(query.get('page'), 'Changing rows per page should load page 1').toBe('1');
        expect(pagination.total, 'Total should not change with rows per page').toBe(total);
        expect(pagination.totalPages, `${total} leads at ${rows} per page`).toBe(expectedPages);
        expect(leads.length, `Page 1 should hold ${rows} leads or all of them`).toBe(Math.min(total, Number(rows)));

        await expect(rowsPerPage(page)).toHaveText(rows);
        await expect(pagerText(page)).toHaveText(pageLabel(1, expectedPages));
        await expect(leadCounter(page), 'Counter should not change with rows per page').toHaveText(counterText(total));
        await expectTableShows(page, leads, `Table should show the first ${rows} leads from the API`);
        if (expectedPages > 1) await expect(nextPage(page), 'Next should be enabled when there are more pages').toBeEnabled();
        else await expect(nextPage(page), 'Next should be disabled when everything fits on one page').toBeDisabled();
        await page.screenshot({ path: `screenshots/Lead/LeadPagination-rows-${rows}.png` });
      });
    }

    await test.step('Changing rows per page on a later page goes back to page 1', async () => {
      const { pagination } = await pickRowsPerPage(page, '10');
      test.skip(pagination.totalPages < 2, `Only ${total} leads: one page of 10, nothing to page through`);
      const second = await loadLeads(page, nextPage(page), q => q.get('page') === '2');
      await expect(pagerText(page)).toHaveText(pageLabel(2, second.pagination.totalPages));

      const { leads, query } = await pickRowsPerPage(page, '20');
      expect(query.get('page'), 'Should go back to page 1').toBe('1');
      await expect(pagerText(page)).toHaveText(pageLabel(1, Math.ceil(total / 20)));
      await expect(previousPage(page)).toBeDisabled();
      await expectTableShows(page, leads, 'Table should show page 1 again');
    });

    await test.step('After a reload the list is back to 20 rows on page 1', async () => {
      await pickRowsPerPage(page, '10');
      const [response] = await Promise.all([leadsResponse(page, q => q.get('page') === '1'), page.reload()]);
      const { query } = await readLeads(response);
      expect(query.get('limit')).toBe(DEFAULT_ROWS);
      await expect(rowsPerPage(page)).toHaveText(DEFAULT_ROWS);
      await expect(pagerText(page)).toHaveText(pageLabel(1, Math.ceil(total / 20)));
    });
  });

  test('Next and previous buttons walk through every page of leads', async ({ page }) => {
    test.setTimeout(240000);
    const first = await openFirstPage(page);

    // 10 rows per page gives the most pages to walk through
    await rowsPerPage(page).click();
    const firstPage = await loadLeads(page, page.getByRole('option', { name: '10', exact: true }), q => q.get('limit') === '10');
    const { total, totalPages } = firstPage.pagination;
    expect(total, 'Total should not depend on rows per page').toBe(first.pagination.total);
    test.skip(totalPages < 2, `Only ${total} leads: one page of 10, nothing to page through`);
    console.log(`${total} leads: ${totalPages} pages of 10`);

    const pages = [firstPage.leads];
    await test.step('Page 1: previous disabled, next enabled', async () => {
      await expect(pagerText(page)).toHaveText(pageLabel(1, totalPages));
      await expect(previousPage(page)).toBeDisabled();
      await expect(nextPage(page)).toBeEnabled();
      await expectTableShows(page, firstPage.leads, 'Page 1 should show the first 10 leads');
    });

    await test.step('Next goes forward one page at a time up to the last page', async () => {
      for (let pageNo = 2; pageNo <= totalPages; pageNo++) {
        const { leads, pagination, query } = await loadLeads(page, nextPage(page), q => q.get('page') === String(pageNo));
        expect(query.get('limit'), 'Rows per page should be kept when paging').toBe('10');
        expect(pagination.total, 'Total should not change between pages').toBe(total);
        const expectedRows = pageNo < totalPages ? 10 : total - 10 * (totalPages - 1);
        expect(leads.length, `Page ${pageNo} should hold ${expectedRows} leads`).toBe(expectedRows);

        await expect(pagerText(page)).toHaveText(pageLabel(pageNo, totalPages));
        await expect(leadCounter(page), 'Counter should not change between pages').toHaveText(counterText(total));
        await expectTableShows(page, leads, `Page ${pageNo} should show its leads from the API`);
        await expect(previousPage(page), `Previous should be enabled on page ${pageNo}`).toBeEnabled();
        pages.push(leads);
      }
      await expect(nextPage(page), 'Next should be disabled on the last page').toBeDisabled();
      await page.screenshot({ path: 'screenshots/Lead/LeadPagination-last-page.png' });
    });

    await test.step('Every lead shows up once across the pages', async () => {
      const ids = pages.flat().map(l => l.id);
      expect(new Set(ids).size, 'No lead should be on two pages').toBe(ids.length);
      expect(ids.length, 'All leads should be on some page').toBe(total);
    });

    await test.step('Previous goes back one page at a time to page 1', async () => {
      for (let pageNo = totalPages - 1; pageNo >= 1; pageNo--) {
        const { leads } = await loadLeads(page, previousPage(page), q => q.get('page') === String(pageNo));
        expect(leads.map(l => l.id), `Page ${pageNo} should hold the same leads as before`).toEqual(pages[pageNo - 1].map(l => l.id));
        await expect(pagerText(page)).toHaveText(pageLabel(pageNo, totalPages));
        await expectTableShows(page, leads, `Page ${pageNo} should show its leads again`);
      }
      await expect(previousPage(page), 'Previous should be disabled back on page 1').toBeDisabled();
      await expect(nextPage(page)).toBeEnabled();
      await page.screenshot({ path: 'screenshots/Lead/LeadPagination-back-to-first.png' });
    });
  });
});
