const { test } = require('@playwright/test');
const { findTodaysDeals, archiveDeal, deleteArchivedDeal } = require('../common/archiveDeal');

// Archives and then permanently deletes the "Vijay - Pipeclose Tech Deal" deals created today (by CreateDeal3)
test("Archive and delete deal - Vijay", async ({ page }) => {
  test.setTimeout(600000);
  const deals = await findTodaysDeals(page, 'Vijay - Pipeclose Tech Deal', {
    person: 'Vijay',
    organization: 'Pipeclose Tech',
    value: '4000',
    phone: '9878473848',
    email: 'vijay.appnox@gmail.com',
    screenshot: 'ArchiveDeleteDeal3-created.png',
  });

  for (const deal of deals) {
    if (!deal.archived) await archiveDeal(page, deal);
    await deleteArchivedDeal(page, deal, 'ArchiveDeleteDeal3');
  }
});
