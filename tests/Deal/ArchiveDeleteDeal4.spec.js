const { test } = require('@playwright/test');
const { findTodaysDeals, archiveDeal, deleteArchivedDeal } = require('../common/archiveDeal');

// Archives and then permanently deletes the "Dev - Microsoft Ai Deal" deals created today (by CreateDeal4)
test("Archive and delete deal - Dev", async ({ page }) => {
  test.setTimeout(600000);
  const deals = await findTodaysDeals(page, 'Dev - Microsoft Ai Deal', {
    person: 'Dev',
    organization: 'Microsoft AI',
    value: '4000',
    phone: '367347474721',
    email: 'dev.appnox@gmail.com',
    screenshot: 'ArchiveDeleteDeal4-created.png',
  });

  for (const deal of deals) {
    if (!deal.archived) await archiveDeal(page, deal);
    await deleteArchivedDeal(page, deal, 'ArchiveDeleteDeal4');
  }
});
