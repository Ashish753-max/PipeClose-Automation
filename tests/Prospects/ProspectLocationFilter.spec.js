const { test, expect } = require('@playwright/test');
const {
  prospectsPage, openProspects, search, openSection, option, openOptions, closeOptions, expectChosen, remove, expectAbout,
} = require('../common/prospects');

// Location filter on Prospects > Find. The results never show a person's location (the provider only gives it
// after enrichment), so the filter is checked through the search it sends and how the matches add up:
// a country narrows the results, two countries match the people of both, and a city matches fewer people
// than its country and adds nobody to it. Screenshots are saved in screenshots/Prospect-Filters/.
test('Prospects - filter by location', async ({ page }) => {
  test.setTimeout(300000);
  const shot = step => page.screenshot({ path: `screenshots/Prospect-Filters/location-${step}.png` });
  const { panel } = prospectsPage(page);
  const all = await openProspects(page);
  const location = await openSection(page, 'Location', 'Country, state or city');
  const locations = (...include) => ({ locations: { include } });

  // A country from the dropdown
  await location.showOptions.click();
  await expect(panel.getByText('Countries', { exact: true })).toBeVisible();
  await expect(panel.getByText('Cities', { exact: true })).toBeVisible();
  await shot('1-dropdown');
  const germany = await search(page, () => option(page, 'Germany').click(), locations('Germany'));
  expect.soft(await openOptions(page).count(), 'Location dropdown should close after picking a location').toBe(0);
  await closeOptions(page, location.field);
  await expectChosen(page, 'Location', ['Germany']);
  expect(germany.total, 'Germany should narrow the results').toBeLessThan(all.total);
  await shot('2-germany');

  // A second country, typed: people in either country
  await location.field.pressSequentially('France', { delay: 30 });
  const germanyFrance = await search(page, () => option(page, 'France').click(), locations('Germany', 'France'));
  await closeOptions(page, location.field);
  await expectChosen(page, 'Location', ['Germany', 'France']);
  await shot('3-germany-france');
  const france = await search(page, remove(page, 'Germany'), locations('France'));
  await expectChosen(page, 'Location', ['France']);
  expectAbout(germanyFrance.total, germany.total + france.total, 'Germany + France should match the people of both countries');

  // A city: added to another country it adds its own people, alone it matches fewer than its country
  await location.field.pressSequentially('Berlin', { delay: 30 });
  const franceBerlin = await search(page, () => option(page, 'Berlin').click(), locations('France', 'Berlin'));
  await closeOptions(page, location.field);
  const berlin = await search(page, remove(page, 'France'), locations('Berlin'));
  await expectChosen(page, 'Location', ['Berlin']);
  expectAbout(franceBerlin.total, france.total + berlin.total, 'France + Berlin should match the people of both');
  expect(berlin.total, 'Berlin should match fewer people than Germany').toBeLessThan(germany.total);
  await shot('4-berlin');

  // Berlin is in Germany, so adding Germany gives the country's people and nobody else
  await location.showOptions.click();
  const berlinGermany = await search(page, () => option(page, 'Germany').click(), locations('Berlin', 'Germany'));
  await closeOptions(page, location.field);
  await expectChosen(page, 'Location', ['Berlin', 'Germany']);
  expectAbout(berlinGermany.total, germany.total, 'Berlin + Germany should match the people of Germany');
  await shot('5-berlin-germany');

  // Clear all brings back every prospect
  const cleared = await search(page, () => panel.getByRole('button', { name: 'Clear all' }).click(), {});
  await expectChosen(page, 'Location', []);
  expectAbout(cleared.total, all.total, 'Clear all should bring back every prospect');
  await shot('6-cleared');
});
