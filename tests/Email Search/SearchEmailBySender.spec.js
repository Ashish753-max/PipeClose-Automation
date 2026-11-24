// Mail > ashish.rai@appnox.ai: search the emails with "kunal.sharma@appnox.ai"
//   1. Inbox: the search finds the emails with kunal.sharma@appnox.ai, and only those
//   2. Sent: the search stays on and finds the emails sent to kunal.sharma@appnox.ai
//   3. Part of the address in upper case finds the same Inbox emails
//   4. A term that matches nothing shows "No results found"
//   5. Clearing the search shows the whole Inbox again
// The search runs on the server for the open folder (/api/emails/list?...&search=). It only reads emails: no email
// is opened, so none is marked as read. Screenshots: screenshots/EmailSearch/SearchEmailBySender-*.png
const { test, expect } = require('@playwright/test');
const { loginStaging } = require('../common/createDeal');
const { openMail, useMailbox, isEmailList, expectCount } = require('../common/mail');

const MAILBOX = 'ashish.rai@appnox.ai';
const SEARCH = 'kunal.sharma@appnox.ai';

const searchBox = page => page.getByPlaceholder('Search emails...');
const emailRows = page => page.getByRole('heading', { level: 4 });
const addressesOf = email => [email.from, ...(email.to || []), ...(email.cc || [])].join(' ').toLowerCase();

/**
 * Runs the action and returns the list the folder loads for this search term ('' = no search): { emails, total }.
 */
async function loadList(page, folder, term, action) {
  const [response] = await Promise.all([
    page.waitForResponse(res => isEmailList(res, folder, MAILBOX)
      && (new URL(res.url()).searchParams.get('search') || '') === term, { timeout: 30000 }),
    action(),
  ]);
  expect(response.status(), `${folder} list for "${term}" should load`).toBe(200);
  return (await response.json()).data;
}

test(`Search the ${MAILBOX} mailbox for ${SEARCH}`, async ({ page }) => {
  test.setTimeout(240000);
  await loginStaging(page);
  await expect(page).toHaveURL(/\/deals/, { timeout: 30000 });

  // The Inbox of ashish.rai@appnox.ai, before searching
  const inbox = await loadList(page, 'inbox', '', async () => {
    await openMail(page);
    await useMailbox(page, MAILBOX);
  });
  await expect(searchBox(page)).toHaveValue('');
  await expectCount(page, inbox.total);
  console.log(`Inbox of ${MAILBOX}: ${inbox.total} emails`);

  await test.step('Inbox: finds the emails with kunal.sharma@appnox.ai only', async () => {
    const found = await loadList(page, 'inbox', SEARCH, () => searchBox(page).fill(SEARCH));
    expect(found.total, `The Inbox should have emails from ${SEARCH}`).toBeGreaterThan(0);
    expect(found.total, 'The search should narrow the Inbox down').toBeLessThan(inbox.total);
    for (const email of found.emails) {
      expect(addressesOf(email), `"${email.subject}" should involve ${SEARCH}`).toContain(SEARCH);
    }
    await expectCount(page, found.total);
    await expect(emailRows(page).first()).toBeVisible();
    console.log(`Inbox search "${SEARCH}": ${found.total} emails, e.g. "${found.emails[0].subject}" from ${found.emails[0].from}`);
    await page.screenshot({ path: 'screenshots/EmailSearch/SearchEmailBySender-1-inbox.png' });
  });

  await test.step('Sent: the search stays on and finds the emails sent to kunal.sharma@appnox.ai', async () => {
    const sent = await loadList(page, 'sent', SEARCH, () => page.getByRole('button', { name: 'Sent', exact: true }).click());
    await expect(page).toHaveURL(/folder=sent/);
    await expect(searchBox(page), 'The search term should stay in the box').toHaveValue(SEARCH);
    expect(sent.total, `Sent should have emails to ${SEARCH}`).toBeGreaterThan(0);
    for (const email of sent.emails) {
      expect([...(email.to || []), ...(email.cc || []), ...(email.bcc || [])].join(' ').toLowerCase(),
        `Sent "${email.subject}" should be addressed to ${SEARCH}`).toContain(SEARCH);
    }
    await expectCount(page, sent.total);
    // Sent rows show the recipient
    await expect(emailRows(page).filter({ hasText: SEARCH }).first()).toBeVisible();
    console.log(`Sent search "${SEARCH}": ${sent.total} emails`);
    await page.screenshot({ path: 'screenshots/EmailSearch/SearchEmailBySender-2-sent.png' });
  });

  let fullSearchIds;
  await test.step('Back in the Inbox, part of the address in upper case finds the same emails', async () => {
    const full = await loadList(page, 'inbox', SEARCH, () => page.getByRole('button', { name: 'Inbox', exact: true }).click());
    fullSearchIds = full.emails.map(e => e.id).sort();
    const partial = await loadList(page, 'inbox', 'KUNAL.SHARMA', () => searchBox(page).fill('KUNAL.SHARMA'));
    expect(partial.emails.map(e => e.id).sort(), 'Search should ignore case and match part of the address')
      .toEqual(fullSearchIds);
  });

  await test.step('A term that matches nothing shows "No results found"', async () => {
    const term = `no-such-email-${Date.now()}`;
    const none = await loadList(page, 'inbox', term, () => searchBox(page).fill(term));
    expect(none.total).toBe(0);
    await expect(page.getByText('No results found')).toBeVisible();
    await expect(emailRows(page)).toHaveCount(0);
  });

  await test.step('Clearing the search shows the whole Inbox again', async () => {
    const all = await loadList(page, 'inbox', '', () => searchBox(page).fill(''));
    // (new mail can arrive while the test runs, so the Inbox may have grown)
    expect(all.total, 'The whole Inbox should be back').toBeGreaterThanOrEqual(inbox.total);
    await expectCount(page, all.total);
    await expect(page.getByText('No results found')).toBeHidden();
  });
});
