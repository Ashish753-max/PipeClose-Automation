const { test, expect, devices } = require('@playwright/test');
const loginConfig = require('../common/loginConfig');
const { findLayoutProblems, visibleShare, tapShare } = require('../common/responsive');

// Checks every field of the Prospects page (Find filters, results table, Saved prospects) on a phone and a tablet.
// Only searches: nothing is saved or enriched, so no credits are used and no data is created.
// Screenshots are saved in screenshots/Prospect-Responsive/ as proof.
const BASE_URL = 'https://staging.pipeclose.com';
const screens = [
  { name: 'mobile', device: 'iPhone 13' }, // 390x664, touch
  { name: 'tablet', device: 'iPad Mini' }, // 768x1024, touch
];

// Filter sections in the order shown, with the value typed into each field
const filters = [
  { section: 'Location', placeholder: 'Country, state or city', value: 'United States', param: 'locations' },
  { section: 'Job titles', placeholder: 'e.g. CTO, VP Sales', value: 'Sales Manager', param: 'titles' },
  { section: 'Company', placeholder: 'e.g. Acme Corp', value: 'microsoft.com', param: 'companies' },
  { section: 'Keywords', placeholder: 'e.g. cold outreach', value: 'saas', param: 'keywords' },
];

const isSearch = r => r.url().includes('/api/integrations/lead-data/search') && r.request().method() === 'POST';

for (const screen of screens) {
  test.describe(`Prospect responsive - ${screen.name}`, () => {
    // Device size, touch and mobile viewport, in Chromium (the device's own browser needs a separate worker)
    const { defaultBrowserType, ...device } = devices[screen.device];
    test.use(device);

    test(`Prospects Find, filters and Saved prospects - ${screen.name} (${screen.device})`, async ({ page }) => {
      test.setTimeout(300000);
      const prefix = `screenshots/Prospect-Responsive/${screen.name}`;
      const shot = step => page.screenshot({ path: `${prefix}-${step}.png` });

      // Bugs fail the test (soft, so every field is still checked); improvements are only logged
      const checkLayout = async (label, root) => {
        const found = await (root ? root.evaluate(findLayoutProblems) : page.evaluate(findLayoutProblems));
        console.log(`\n[${screen.name}] ${label}: page scrolls sideways by ${found.pageScroll}px`);
        if (found.cutOff.length) console.log('  cut off at the screen edge:', found.cutOff);
        if (found.covered.length) console.log('  covered:', found.covered);
        if (found.hiddenButFocusable) console.log(`  ${found.hiddenButFocusable} off-screen controls still reachable with Tab`);
        if (found.small.length) console.log(`  ${found.small.length} tap targets under 24px:`, found.small.slice(0, 8));
        if (found.tinyText.length) console.log(`  ${found.tinyText.length} texts under 12px:`, found.tinyText.slice(0, 8));
        expect.soft(found.pageScroll, `${label}: page should not scroll sideways`).toBeLessThanOrEqual(0);
        expect.soft(found.cutOff, `${label}: controls should not be cut off at the screen edge`).toEqual([]);
        expect.soft(found.covered, `${label}: controls should not be covered by another element`).toEqual([]);
        return found;
      };
      // Scrolled into view, the whole control can be seen and tapped (nothing on top of any part of it)
      const reachable = async (locator, what) => {
        const share = await visibleShare(locator);
        const tap = await tapShare(locator);
        console.log(`[${screen.name}] ${what}: ${Math.round(share * 100)}% can be seen, ${Math.round(tap * 100)}% can be tapped`);
        expect.soft(share, `${what} should be fully on screen`).toBeGreaterThan(0.95);
        expect.soft(tap, `${what} should not be covered`).toBe(1);
      };

      // Login
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /width=device-width/);
      await page.getByPlaceholder('Email').fill(loginConfig.email);
      await page.getByPlaceholder('Password').fill(loginConfig.password);
      await page.locator("//button[@type='submit']").click();
      await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 30000 });

      // Prospects: Find opens with the first 100 results
      await Promise.all([
        page.waitForResponse(isSearch, { timeout: 60000 }),
        page.goto(`${BASE_URL}/prospects`),
      ]);
      const rows = page.getByRole('row').filter({ has: page.getByRole('checkbox', { name: /^Select (?!all)/ }) });
      await expect(rows.first()).toBeVisible({ timeout: 30000 });
      await page.getByRole('button', { name: 'Accept', exact: true }).click({ timeout: 5000 }).catch(() => {});
      await checkLayout('Prospects Find');
      await shot('01-find');

      // Navigation: phones open it from the menu button, tablets show the sidebar
      const prospectsNav = page.getByRole('navigation').locator('a[href="/prospects"]');
      if (!(await prospectsNav.evaluate(el => el.getBoundingClientRect().right > 0))) {
        await page.getByRole('banner').getByRole('button').first().click();
        await expect(prospectsNav, 'Menu button should open the navigation').toBeInViewport();
        await shot('02-menu-open');
        await page.mouse.click(page.viewportSize().width - 40, 400); // tap the dimmed page beside the menu
        await expect.soft(prospectsNav, 'Tapping outside should close the menu').not.toBeInViewport();
      } else {
        await expect(prospectsNav).toBeInViewport();
      }

      // Header: tabs, filters button, matches and credits
      const main = page.getByRole('main').first();
      const results = main.getByRole('main');
      for (const name of ['Saved prospects', 'Find']) {
        await reachable(main.getByRole('button', { name, exact: true }), `${name} tab`);
      }
      const toggle = main.getByRole('button', { name: /^(Show|Hide) filters$/ });
      await reachable(toggle, 'Show filters button');
      await expect.soft(main.getByText(/matches/).first(), 'Matches count should show').toBeInViewport();
      await expect.soft(main.getByText(/[\d,]+ credits/).first(), 'Credits should show').toBeInViewport();

      // Results table: every column header, then each field of the first row
      const headers = results.getByRole('columnheader');
      const shownColumns = [];
      for (const header of await headers.all()) {
        const text = (await header.innerText()).trim();
        if (!text) continue;
        if (await header.isVisible()) {
          shownColumns.push(text);
          const share = await visibleShare(header);
          expect.soft(share, `"${text}" column header should not be cut off`).toBeGreaterThan(0.95);
        }
      }
      console.log(`[${screen.name}] results show the columns:`, shownColumns);
      expect.soft(shownColumns, 'Person column should show').toContain('PERSON');
      await reachable(results.getByRole('checkbox', { name: 'Select all rows on this page' }), 'Select all checkbox');
      const row = rows.first();
      await reachable(row.getByRole('checkbox'), 'Row checkbox');
      await reachable(row.getByRole('button', { name: 'Save', exact: true }), 'Row Save button');
      const enrich = row.getByRole('button', { name: /^Enrich/ });
      if (await enrich.isVisible()) await reachable(enrich, 'Row Enrich button');
      else console.log(`[${screen.name}] Enrich button is hidden on this screen`);
      await shot('03-results');

      // Filter these rows
      const rowFilter = results.getByPlaceholder(/^Filter these \d+ rows$/);
      await reachable(rowFilter, 'Filter rows field');
      const firstName = (await row.getByRole('checkbox').getAttribute('aria-label')).replace(/^Select /, '').split(' ')[0];
      const before = await rows.count();
      await rowFilter.fill(firstName);
      await expect(rows.first(), 'Filtered rows should match the typed name').toContainText(firstName);
      console.log(`[${screen.name}] filter "${firstName}": ${before} rows -> ${await rows.count()}`);
      await expect(rowFilter, 'Filter field should stay on screen while typing').toBeInViewport();
      await shot('04-row-filter');
      await rowFilter.fill('');
      await expect(rows).toHaveCount(before);

      // Hide checkboxes and pagination
      for (const name of ['Hide enriched emails', 'Hide saved prospects']) {
        await reachable(results.getByRole('checkbox', { name }), `${name} checkbox`);
      }
      const next = results.getByRole('button', { name: 'Next page' });
      const previous = results.getByRole('button', { name: 'Previous page' });
      await reachable(next, 'Next page');
      await next.click();
      await expect(results.getByText(/^26–50 of \d+$/), 'Next page should show rows 26 to 50').toBeVisible();
      await reachable(previous, 'Previous page');
      await previous.click();
      await expect(results.getByText(/^1–25 of \d+$/)).toBeVisible();

      // Filters panel
      const panel = page.getByRole('complementary').filter({ has: page.getByRole('heading', { name: 'Filters' }) });
      if (!(await panel.isVisible())) await toggle.click();
      await expect(panel).toBeVisible();
      await shot('05-filters-open');
      const vw = page.viewportSize().width;
      const panelBox = await panel.boundingBox();
      const resultsBox = await results.boundingBox();
      console.log(`[${screen.name}] filters open: panel ${Math.round(panelBox.width)}px, results beside it ${Math.round(resultsBox?.width || 0)}px`);
      expect.soft(panelBox.x >= 0 && panelBox.x + panelBox.width <= vw + 1, 'Filters panel should fit the screen width').toBe(true);
      // Either the panel takes the whole screen, or the results beside it keep room to read a row
      expect.soft(panelBox.width >= vw - 70 || (resultsBox?.width || 0) >= 300,
        'Results should not be squeezed beside the open filters').toBe(true);

      for (const [i, f] of filters.entries()) {
        const section = panel.getByRole('button', { name: new RegExp(`^${f.section}( \\d+)?$`) });
        if (await section.getAttribute('aria-expanded') !== 'true') await section.click();
        const field = panel.getByPlaceholder(f.placeholder);
        await reachable(field, `${f.section} field`);
        const box = await field.boundingBox();
        expect.soft(box.width, `${f.section} field should be wide enough to type in`).toBeGreaterThanOrEqual(150);

        await field.click();
        await field.pressSequentially(f.value, { delay: 30 });
        await page.waitForTimeout(1500); // suggestions load as you type
        await shot(`${String(6 + i * 2).padStart(2, '0')}-${f.param}-typing`);
        await expect.soft(field, `${f.section} field should stay on screen while typing`).toBeInViewport();

        const [search] = await Promise.all([page.waitForResponse(isSearch), field.press('Enter')]);
        const params = search.request().postDataJSON().params;
        expect.soft(JSON.stringify(params[f.param]), `Search should filter by ${f.section}`).toContain(f.value);
        const chip = panel.getByRole('button', { name: `Remove ${f.value}` });
        await expect(chip, `${f.value} should be added`).toBeVisible();
        await reachable(chip, `Remove ${f.value} chip`);

        // The suggestion list opens on top of the next sections, so it must close once a value is picked
        const options = panel.getByRole('button', { name: 'Include', exact: true });
        const stillOpen = await options.count();
        expect.soft(stillOpen, `${f.section} suggestions should close after adding a value`).toBe(0);
        await shot(`${String(7 + i * 2).padStart(2, '0')}-${f.param}-added`);
        if (stillOpen) {
          await field.press('Escape');
          await expect(options).toHaveCount(0);
        }
      }
      await checkLayout('Filters with every field filled', panel);

      // Clear all removes every filter and searches again
      const clearAll = panel.getByRole('button', { name: 'Clear all' });
      await reachable(clearAll, 'Clear all');
      // (an earlier search can still be in flight, so wait for the one without filters)
      const unfiltered = r => isSearch(r) && JSON.stringify(r.request().postDataJSON().params) === '{"perPage":100}';
      await Promise.all([page.waitForResponse(unfiltered, { timeout: 30000 }), clearAll.click()]);
      await expect(panel.getByRole('button', { name: /^Remove / })).toHaveCount(0);
      await shot('14-filters-cleared');
      await toggle.click(); // close the filters again
      await expect(panel).toBeHidden();

      // Saved prospects tab (no list is created)
      await main.getByRole('button', { name: 'Saved prospects', exact: true }).click();
      await expect(main.getByRole('heading', { name: 'Saved prospects', level: 1 })).toBeVisible({ timeout: 30000 });
      await checkLayout('Saved prospects');
      for (const name of ['All enriched', 'New list', 'Find prospects']) {
        const button = main.getByRole('button', { name, exact: true });
        if (await button.isVisible()) await reachable(button, `${name} button`);
      }
      await shot('15-saved-prospects');
    });
  });
}
