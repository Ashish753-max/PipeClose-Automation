// tests/common/starEmail.js
// The steps of the Star email scripts (tests/Email Actions/StarInboxEmail.spec.js and StarSentEmail.spec.js).
// Both do the same, one in Inbox and one in Sent, in the mailbox ashish.rai@appnox.ai:
//   1. Open the folder and note how many emails its Starred view lists
//   2. In All mail, star the newest email that is not starred yet
//   3. Open Starred: the count went up by one, and the email is listed as in the folder, with a filled star
//   4. Reload: the email is still starred
//   5. Unstar it again, so the mailbox is left as it was
// Screenshots: screenshots/StarEmail/<folder>-*.png
const { expect } = require('@playwright/test');
const { loginStaging } = require('./createDeal');
const { emailRows, isEmailList, openMail, useMailbox } = require('./mail');

const MAILBOX = 'ashish.rai@appnox.ai';

/**
 * Runs the star email steps in a folder.
 * @param {import('@playwright/test').Page} page
 * @param {'Inbox' | 'Sent'} folder
 */
async function starEmail(page, folder) {
  const rows = emailRows(page);

  // Step 1: Open the folder and note how many emails its Starred view lists
  await loginStaging(page);
  await expect(page).toHaveURL(/\/deals/, { timeout: 30000 });
  await openMail(page);
  await openFolder(page, folder);
  // The Starred view stays on when switching folders, so start from All mail
  if (await isStarredViewOn(page)) await showView(page, folder, 'All mail');
  const before = await showView(page, folder, 'Starred');
  await expectCount(page, before.total);
  console.log(`${folder}: ${before.total} starred before`);
  await takeScreenshot(page, folder, '1-starred-before');

  // Step 2: In All mail, star the newest email that is not starred yet
  const allMail = await showView(page, folder, 'All mail');
  const index = allMail.emails.findIndex(email => !email.isStarred);
  expect(index, `${folder} should have an email that is not starred`).toBeGreaterThanOrEqual(0);
  const email = allMail.emails[index];
  const row = rows.nth(index); // the rows are in the same order as the loaded emails
  await expect(row).toContainText(email.subject);
  const rowText = await row.innerText();
  console.log(`${folder}: starring "${email.subject}"`);
  await expectNotStarred(row);
  await clickStar(page, row, email.id, 'star');
  await expectStarred(row);
  await takeScreenshot(page, folder, '2-starred-in-list');

  // Step 3: Open Starred: the count went up by one, and the email is listed as in the folder, with a filled star
  const starred = await showView(page, folder, 'Starred');
  expect(starred.total, 'The Starred count should go up by one').toBe(before.total + 1);
  expect(starred.emails.every(item => item.isStarred), 'Starred should list only starred emails').toBe(true);
  const position = starred.emails.findIndex(item => item.id === email.id);
  expect(position, 'Starred should list the email').toBeGreaterThanOrEqual(0);
  const starredRow = rows.nth(position);
  await expectCount(page, starred.total);
  await expect(starredRow, 'The email should be shown as in the folder').toHaveText(rowText, { useInnerText: true });
  await expectStarred(starredRow);
  await takeScreenshot(page, folder, '3-starred-view');

  // Step 4: Reload: the email is still starred
  await page.reload();
  await useMailbox(page, MAILBOX);
  await page.getByRole('button', { name: folder, exact: true }).click();
  if (!(await isStarredViewOn(page))) await showView(page, folder, 'Starred');
  await expect(starredRow, 'Still starred after a reload').toHaveText(rowText, { useInnerText: true, timeout: 30000 });
  await expectStarred(starredRow);
  await takeScreenshot(page, folder, '4-starred-after-reload');

  // Step 5: Unstar it again, so the mailbox is left as it was
  await clickStar(page, starredRow, email.id, 'unstar');
  await expectCount(page, before.total);
  const after = await showView(page, folder, 'All mail');
  const unstarredIndex = after.emails.findIndex(item => item.id === email.id);
  expect(after.emails[unstarredIndex].isStarred, 'The email should be unstarred').toBe(false);
  await expectNotStarred(rows.nth(unstarredIndex));
  await takeScreenshot(page, folder, '5-unstarred');
}

// Opens the folder of the mailbox
async function openFolder(page, folder) {
  await useMailbox(page, MAILBOX);
  await page.getByRole('button', { name: folder, exact: true }).click();
  if (folder === 'Sent') {
    await expect(page).toHaveURL(/folder=sent/);
  } else {
    await expect(page).not.toHaveURL(/folder=/);
  }
}

async function isStarredViewOn(page) {
  const starredButton = page.getByRole('button', { name: 'Starred', exact: true });
  return (await starredButton.getAttribute('aria-pressed')) === 'true';
}

// Switches the open folder to its "All mail" or "Starred" view, and returns what the view loaded:
// { emails, total }, with the emails in the same order as the rows. The view must not be shown already.
async function showView(page, folder, view) {
  const button = page.getByRole('button', { name: view, exact: true });
  const starredOnly = view === 'Starred';
  const [response] = await Promise.all([
    page.waitForResponse(res => {
      if (!isEmailList(res, folder.toLowerCase(), MAILBOX)) return false;
      const isStarredList = new URL(res.url()).searchParams.get('starredOnly') === 'true';
      return isStarredList === starredOnly;
    }),
    button.click(),
  ]);
  expect(response.status(), `${folder} ${view} should load`).toBe(200);
  await expect(button, `${view} should be on`).toHaveAttribute('aria-pressed', 'true');
  const body = await response.json();
  return body.data;
}

// Checks the count above the list, e.g. "1-50 of 116", or "Nothing here" when the view is empty
async function expectCount(page, total) {
  if (total === 0) {
    await expect(page.getByRole('heading', { name: 'Nothing here' })).toBeVisible();
    return;
  }
  const count = page.getByText(/^\s*\d+-\d+\s*of\s*\d+\s*$/).first();
  const lastShown = Math.min(total, 50); // a page lists up to 50 emails
  await expect(count).toHaveText(`1-${lastShown} of ${total}`);
}

// Clicks the row's star button ('star' or 'unstar') and checks the server saved it for this email
async function clickStar(page, row, emailId, action) {
  const button = action === 'star' ? starButton(row) : unstarButton(row);
  const [response] = await Promise.all([
    page.waitForResponse(res => res.url().endsWith(`/api/emails/${emailId}/${action}`)),
    button.click(),
  ]);
  expect(response.status(), `${action} should succeed`).toBe(200);
  const body = await response.json();
  expect(body.data.isStarred, `The email should be saved as ${action}red`).toBe(action === 'star');
}

// The star button reads "Star" (grey outline) and, once starred, "Unstar" (filled amber star)
function starButton(row) {
  return row.getByRole('button', { name: 'Star', exact: true });
}

function unstarButton(row) {
  return row.getByRole('button', { name: 'Unstar', exact: true });
}

async function expectStarred(row) {
  await expect(unstarButton(row), 'The star should be marked').toBeVisible();
  await expect(unstarButton(row), 'The star should be amber').toHaveClass(/text-amber-400/);
  await expect(unstarButton(row).locator('svg'), 'The star should be filled').toHaveAttribute('fill', 'currentColor');
}

async function expectNotStarred(row) {
  await expect(starButton(row), 'The star should not be marked').toBeVisible();
  await expect(starButton(row), 'The star should be grey').toHaveClass(/text-slate-300/);
  await expect(starButton(row).locator('svg'), 'The star should be an outline').toHaveAttribute('fill', 'none');
}

async function takeScreenshot(page, folder, step) {
  // animations: 'disabled' finishes the rows' fade-in, so the picture is not faded
  await page.screenshot({ path: `screenshots/StarEmail/${folder}-${step}.png`, animations: 'disabled' });
}

module.exports = { starEmail };
