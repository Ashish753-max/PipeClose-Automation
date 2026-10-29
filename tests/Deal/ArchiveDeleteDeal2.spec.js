const { test } = require('@playwright/test');
const { findTodaysDeals, archiveDeal, deleteArchivedDeal } = require('../common/archiveDeal');

// Archives and then permanently deletes the "Shivam - Pipeclose Deal" deals created today (by CreateDeal2)
test("Archive and delete deal - Shivam", async ({ page }) => {
  test.setTimeout(600000);
  const deals = await findTodaysDeals(page, 'Shivam - Pipeclose Deal', {
    person: 'Shivam',
    organization: 'Pipeclose',
    value: '4000',
    phone: '9878473848',
    email: 'shivam.appnox@gmail.com',
    screenshot: 'ArchiveDeleteDeal2-created.png',
  });

  for (const deal of deals) {
    if (!deal.archived) await archiveDeal(page, deal);
    await deleteArchivedDeal(page, deal, 'ArchiveDeleteDeal2');
  }
});
