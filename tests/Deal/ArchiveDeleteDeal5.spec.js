const { test } = require('@playwright/test');
const { findTodaysDeals, archiveDeal, deleteArchivedDeal } = require('../common/archiveDeal');

// Archives and then permanently deletes the "Kunal - Google India Deal" deals created today (by CreateDeal5)
test("Archive and delete deal - Kunal", async ({ page }) => {
  test.setTimeout(600000);
  const deals = await findTodaysDeals(page, 'Kunal - Google India Deal', {
    person: 'Kunal',
    organization: 'Google India',
    value: '4000',
    phone: '34738284738',
    email: 'kunal.appnox@gmail.com',
    screenshot: 'ArchiveDeleteDeal5-created.png',
  });

  for (const deal of deals) {
    if (!deal.archived) await archiveDeal(page, deal);
    await deleteArchivedDeal(page, deal, 'ArchiveDeleteDeal5');
  }
});
