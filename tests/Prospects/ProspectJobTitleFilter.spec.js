const { test, expect } = require('@playwright/test');
const {
  prospectsPage, openProspects, search, expectRows, openSection, option, openOptions, closeOptions, expectChosen, remove,
  expectTitles,
} = require('../common/prospects');

// Job titles filter on Prospects > Find: a title picked from the dropdown, then a typed one, then together with
// a location. Every person returned must have a chosen title, and the table must list exactly those people.
// Screenshots are saved in screenshots/Prospect-Filters/.
test('Prospects - filter by job title', async ({ page }) => {
  test.setTimeout(300000);
  const shot = step => page.screenshot({ path: `screenshots/Prospect-Filters/job-title-${step}.png` });
  const { panel } = prospectsPage(page);
  const all = await openProspects(page);
  const jobTitles = await openSection(page, 'Job titles', 'e.g. CTO, VP Sales');
  const titles = (...include) => ({ titles: { include } });
  // The provider also matches the title written out, e.g. "Chief Technology Officer" for CTO
  const CTO = ['CTO', 'Chief Technology Officer'];

  // The dropdown groups common titles
  await jobTitles.showOptions.click();
  for (const group of ['Founders & owners', 'C-suite', 'VP', 'Head of', 'Director', 'Manager']) {
    await expect(panel.getByText(group, { exact: true }), `Dropdown should list the ${group} titles`).toBeVisible();
  }
  await shot('1-dropdown');

  // Sales Manager from the dropdown: every person on every page is a Sales Manager
  const salesManager = await search(page, () => option(page, 'Sales Manager').click(), titles('Sales Manager'));
  expect.soft(await openOptions(page).count(), 'Job titles dropdown should close after picking a title').toBe(0);
  await closeOptions(page, jobTitles.field);
  await expectChosen(page, 'Job titles', ['Sales Manager']);
  expect(salesManager.total, 'Sales Manager should narrow the results').toBeLessThan(all.total);
  expectTitles(salesManager.leads, ['Sales Manager']);
  await expectRows(page, salesManager.leads, Math.ceil(salesManager.leads.length / 25));
  await shot('2-sales-manager');

  // A typed title added with Enter: people with either title
  await jobTitles.field.pressSequentially('CTO', { delay: 30 });
  const either = await search(page, () => jobTitles.field.press('Enter'), titles('Sales Manager', 'CTO'));
  await closeOptions(page, jobTitles.field);
  await expectChosen(page, 'Job titles', ['Sales Manager', 'CTO']);
  expectTitles(either.leads, ['Sales Manager', ...CTO]);
  await shot('3-sales-manager-cto');

  // Removing Sales Manager leaves only CTOs
  const cto = await search(page, remove(page, 'Sales Manager'), titles('CTO'));
  await expectChosen(page, 'Job titles', ['CTO']);
  expectTitles(cto.leads, CTO);
  // Some people hold both titles, so together they match at least each title and at most both added up
  expect(either.total, 'Either title should match at least the Sales Managers').toBeGreaterThanOrEqual(salesManager.total);
  expect(either.total, 'Either title should match at least the CTOs').toBeGreaterThanOrEqual(cto.total);
  expect(either.total, 'Either title should match at most both added up').toBeLessThanOrEqual(salesManager.total + cto.total);

  // With a location both filters apply: CTOs in Germany
  const location = await openSection(page, 'Location', 'Country, state or city');
  await location.showOptions.click();
  const ctoGermany = await search(page, () => option(page, 'Germany').click(),
    { ...titles('CTO'), locations: { include: ['Germany'] } });
  await closeOptions(page, location.field);
  await expectChosen(page, 'Location', ['Germany']);
  await expectChosen(page, 'Job titles', ['CTO']);
  expectTitles(ctoGermany.leads, CTO);
  expect(ctoGermany.total, 'CTOs in Germany should be fewer than all CTOs').toBeLessThan(cto.total);
  await shot('4-cto-germany');

  // Clear all removes both
  await search(page, () => panel.getByRole('button', { name: 'Clear all' }).click(), {});
  await expectChosen(page, 'Job titles', []);
  await expectChosen(page, 'Location', []);
  await shot('5-cleared');
});
