// =====================================================================================================================
// TC_CAMPAIGN_07 - Search campaigns by name
// =====================================================================================================================
// Purpose      : The "Search campaigns" box filters the campaigns table correctly: it shows every campaign whose name
//                contains the search text (any case) and hides all the others.
// Test data    : Two campaigns created for the test: "QA Auto Search Alpha" and "QA Auto Search Beta".
//                The other campaigns in the account are checked too, whatever they are.
// Precondition : User can log in. Campaigns with these names left by an earlier run are deleted first
//                (only this script uses these names).
//
// The search runs in the browser (no request to the server): it matches part of the name, ignores case and
// ignores spaces typed before or after the text.
//
// Steps and expected results
//   1. Log in, open Campaigns and create the two campaigns
//        -> Both are listed in the table
//   2. Search "QA Auto Search"
//        -> Only the two test campaigns are shown
//   3. Search "Search Alpha", then "Beta"
//        -> Only the matching campaign is shown each time
//   4. Search "qa auto search beta" (lower case) and "  QA AUTO SEARCH ALPHA  " (upper case, spaces around)
//        -> The search ignores case and surrounding spaces: the matching campaign is shown
//   5. Search a word other campaigns also use ("QA", and the first word of another campaign's name)
//        -> The table shows exactly the campaigns whose names contain it (compared with the full list)
//   6. Search a name no campaign has
//        -> The table is replaced by "No campaign matches."
//   7. Clear the search
//        -> The full list is shown again, in the same order
//
// Cleanup      : Both campaigns are deleted at the end (also when the test fails).
// Screenshots  : screenshots/Campaign/SearchCampaign-*.png
// =====================================================================================================================
const { test, expect } = require('@playwright/test');
const { loginStaging } = require('../common/createDeal');
const {
  openCampaigns, createCampaign, deleteCampaignIfExists, campaignNames, backToCampaigns, campaignSearchBox,
  shownCampaignNames,
} = require('../common/campaign');

const ALPHA = 'QA Auto Search Alpha';
const BETA = 'QA Auto Search Beta';
const NO_MATCH = 'zz No Such Campaign 7f3k';

// The campaigns of the full list that the search should show: names containing the text, any case
function expectedMatches(allNames, text) {
  const wanted = text.trim().toLowerCase();
  return allNames.filter(name => name.toLowerCase().includes(wanted));
}

test.afterEach(async ({ page }) => {
  await deleteCampaignIfExists(page, ALPHA);
  await deleteCampaignIfExists(page, BETA);
});

test('TC_CAMPAIGN_07: Search campaigns by name filters the table', async ({ page }) => {
  const main = page.getByRole('main');
  const searchBox = campaignSearchBox(page);

  // Types the text in the search box and checks the table shows exactly these campaigns, in list order
  async function searchAndExpect(text, expected, message) {
    await searchBox.fill(text);
    await expect.poll(() => shownCampaignNames(page), { message, timeout: 10000 }).toEqual(expected);
    console.log(`Search "${text}" -> ${expected.length} campaign(s)`);
  }

  // Step 1: Create the two campaigns to search for
  await loginStaging(page);
  await openCampaigns(page);
  await deleteCampaignIfExists(page, ALPHA);
  await deleteCampaignIfExists(page, BETA);
  await backToCampaigns(page);
  await createCampaign(page, ALPHA);
  await backToCampaigns(page);
  await createCampaign(page, BETA);
  await backToCampaigns(page);

  await expect(searchBox, 'The search box should be shown, empty').toHaveValue('');
  await expect(searchBox).toHaveAttribute('placeholder', 'Search by name');
  const allNames = await campaignNames(page);
  expect(allNames, 'Both test campaigns should be listed').toEqual(expect.arrayContaining([ALPHA, BETA]));
  console.log(`The table lists ${allNames.length} campaigns`);

  // Step 2: Text both test campaigns share
  await searchAndExpect('QA Auto Search', expectedMatches(allNames, 'QA Auto Search'),
    'Only the campaigns named "QA Auto Search ..." should be shown');
  expect(await shownCampaignNames(page)).toEqual(expect.arrayContaining([ALPHA, BETA]));
  await page.screenshot({ path: 'screenshots/Campaign/SearchCampaign-1-both.png' });

  // Step 3: Text only one of them has
  await searchAndExpect('Search Alpha', [ALPHA], `Only "${ALPHA}" should be shown`);
  await searchAndExpect('Beta', expectedMatches(allNames, 'Beta'), 'Only campaigns with "Beta" in the name should be shown');
  expect(await shownCampaignNames(page), `"${BETA}" should be shown`).toContain(BETA);
  expect(await shownCampaignNames(page), `"${ALPHA}" should be hidden`).not.toContain(ALPHA);

  // Step 4: Case and surrounding spaces do not matter
  await searchAndExpect('qa auto search beta', [BETA], 'The search should ignore case (lower case)');
  await searchAndExpect('  QA AUTO SEARCH ALPHA  ', [ALPHA], 'The search should ignore case and surrounding spaces');
  await page.screenshot({ path: 'screenshots/Campaign/SearchCampaign-2-one.png' });

  // Step 5: Words other campaigns use too: the table shows exactly the campaigns that contain them
  // "QA", plus the first word of another campaign's name that is not "QA" (if there is one)
  const otherWord = allNames.filter(name => ![ALPHA, BETA].includes(name))
    .map(name => name.split(/\s+/)[0])
    .find(word => word.toLowerCase() !== 'qa');
  const commonWords = ['QA', otherWord].filter(Boolean);
  for (const word of commonWords) {
    const expected = expectedMatches(allNames, word);
    await searchAndExpect(word, expected, `The table should show exactly the campaigns containing "${word}"`);
    for (const name of await shownCampaignNames(page)) {
      expect(name.toLowerCase(), `"${name}" is shown, so it should contain "${word}"`).toContain(word.toLowerCase());
    }
  }
  await page.screenshot({ path: 'screenshots/Campaign/SearchCampaign-3-common-word.png' });

  // Step 6: No campaign matches
  await searchAndExpect(NO_MATCH, [], 'No campaign should be shown for a name no campaign has');
  await expect(main.getByText('No campaign matches.'), 'The table should say nothing matches').toBeVisible();
  await expect(main.getByRole('table'), 'The table should be hidden').toHaveCount(0);
  await page.screenshot({ path: 'screenshots/Campaign/SearchCampaign-4-no-match.png' });

  // Step 7: Clearing the search shows the full list again
  await searchAndExpect('', allNames, 'Clearing the search should show every campaign again, in the same order');
  await expect(main.getByText('No campaign matches.')).toHaveCount(0);
  await page.screenshot({ path: 'screenshots/Campaign/SearchCampaign-5-cleared.png' });
});
