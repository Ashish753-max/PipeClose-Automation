const { test } = require('@playwright/test');
const { findTodaysDeals, archiveDeal, deleteArchivedDeal } = require('../common/archiveDeal');

// Archives and then permanently deletes the "Ashish - Appnox Technologies Pvt. Ltd. Deal" deals created today (by CreateDeal1)
test("Archive and delete deal - Ashish Rai", async ({ page }) => {
  test.setTimeout(600000);
  const deals = await findTodaysDeals(page, 'Ashish - Appnox Technologies Pvt. Ltd. Deal', {
    person: 'Ashish Rai',
    organization: 'Appnox Technologies Pvt. Ltd.',
    value: '4000',
    phone: '9878473848',
    email: 'ashishappnox1@gmail.com',
    screenshot: 'ArchiveDeleteDeal1-created.png',
  });

  for (const deal of deals) {
    if (!deal.archived) await archiveDeal(page, deal);
    await deleteArchivedDeal(page, deal, 'ArchiveDeleteDeal1');
  }
});
