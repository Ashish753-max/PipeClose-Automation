// tests/common/emailFolders.js
// The steps of the Email Actions scripts that take an email out of Archive, Spam or Trash:
//   ArchiveToInbox, SpamToInbox, TrashToInbox: the newest Inbox email is put in the folder and moved back to the
//     Inbox (moveBackToInbox). The mailbox is left as it was: the email ends in the Inbox, read or unread as before.
//   DeleteForeverFromTrash: a test email is deleted forever from Trash (deleteForever), and Trash is emptied (emptyTrash)
// The delete tests only destroy test emails (subject "Email Actions test ..."), never a real email. They reuse a test
// email already in Trash; when there is none they send one from ashish.rai@appnox.ai to itself. The mail server
// delivers it to the Inbox only on a sync, which takes minutes on staging, so these tests can take ~10 minutes.
// Screenshots: screenshots/EmailActions/<script>-*.png
const { test, expect } = require('@playwright/test');
const { loginStaging } = require('./createDeal');
const { emailRows, openMail, useMailbox, openFolder, expectCount } = require('./mail');

const BASE_URL = 'https://staging.pipeclose.com';
const MAILBOX = 'ashish.rai@appnox.ai';
const ACCOUNT_ID = `2-${MAILBOX}`;
const TEST_SUBJECT = 'Email Actions test';
const BODY = 'Automated test email for the Email Actions tests. Please ignore.';
const SYNC_TIMEOUT = 12 * 60000; // how long to wait for the mail server to deliver or move a test email

// The hover buttons that put an Inbox email in the folder and take it back out, and the API each one calls
const FOLDERS = {
  Archive: { moveIn: { button: 'Archive', api: 'archive' }, moveBack: { button: 'Move to inbox', api: 'unarchive' } },
  Spam: { moveIn: { button: 'Mark as spam', api: 'spam' }, moveBack: { button: 'Not spam', api: 'unspam' } },
  Trash: { moveIn: { button: 'Delete', api: 'trash' }, moveBack: { button: 'Move to inbox', api: 'restore' } },
};

// Delete Forever (Trash toolbar) and the Delete hover button in Trash ask this before deleting
const DELETE_FOREVER_QUESTION = 'Permanently delete this email? This action cannot be undone.';

/**
 * Puts the newest Inbox email in Archive, Spam or Trash, moves it back to the Inbox with the folder's hover button,
 * and checks that the folder no longer lists it and the Inbox shows it again as before.
 * @param {import('@playwright/test').Page} page
 * @param {'Archive' | 'Spam' | 'Trash'} folder
 * @param {string} script name used in the screenshots, e.g. 'ArchiveToInbox'
 */
async function moveBackToInbox(page, folder, script) {
  const { moveIn, moveBack } = FOLDERS[folder];
  await startInMail(page);

  // Step 1: Pick the newest Inbox email, and note how its row looks
  const inbox = await openFolder(page, MAILBOX, 'Inbox');
  const email = inbox.emails.find(isInboxEmail);
  expect(email, 'The Inbox should have an email').toBeTruthy();
  const inboxRow = await rowFor(page, inbox, email);
  const rowText = await inboxRow.innerText();
  const sender = (await inboxRow.getByRole('heading', { level: 4 }).innerText()).trim();
  console.log(`Email: from "${sender}", subject "${email.subject}" (${email.isRead ? 'read' : 'unread'})`);
  await takeScreenshot(page, script, '1-inbox-before');

  // Step 2: Put it in the folder with its Inbox hover button: it leaves the Inbox
  await clickRowButton(page, inboxRow, email, moveIn);
  let leftInFolder = true;
  try {
    // Step 3: The folder lists it, and its hover buttons offer to move it back to the Inbox
    const inFolder = await openFolder(page, MAILBOX, folder);
    const folderRow = await rowFor(page, inFolder, email);
    await expectCount(page, inFolder.total);
    console.log(`${folder}: lists the email (${inFolder.total} emails)`);
    await takeScreenshot(page, script, `2-in-${folder.toLowerCase()}`);
    await folderRow.hover();
    await expect(folderRow.getByRole('button', { name: moveBack.button, exact: true }),
      `${folder} should offer "${moveBack.button}"`).toBeVisible();
    await takeScreenshot(page, script, '3-hover-actions');

    // Step 4: Move it back: it leaves the folder
    await clickRowButton(page, folderRow, email, moveBack);
    leftInFolder = false;
    await takeScreenshot(page, script, '4-after-move-back');
    const afterMove = await openFolder(page, MAILBOX, folder);
    expect(idsOf(afterMove), `${folder} should no longer list the email`).not.toContain(email.id);
    await expectCount(page, afterMove.total);
    console.log(`${folder}: no longer lists the email (${afterMove.total} emails)`);
  } finally {
    if (leftInFolder) console.error(`The email "${email.subject}" was left in ${folder}: move it back to the Inbox by hand`);
  }

  // Step 5: The Inbox lists it again, as before, with the Inbox buttons (not the ones of the folder it came from)
  const back = await openFolder(page, MAILBOX, 'Inbox');
  const backRow = await rowFor(page, back, email);
  await expectCount(page, back.total);
  await expect(backRow, 'The row should look as before').toHaveText(rowText, { useInnerText: true });
  await expect(backRow.getByRole('heading', { level: 4 })).toHaveText(sender);
  expect(back.emails.find(item => item.id === email.id).isRead, 'Read or unread as before').toBe(email.isRead);
  await backRow.hover();
  for (const name of ['Archive', 'Delete', 'Mark as spam']) {
    await expect(backRow.getByRole('button', { name, exact: true }), `Inbox hover should offer "${name}"`).toBeVisible();
  }
  for (const name of ['Move to inbox', 'Not spam']) {
    await expect(backRow.getByRole('button', { name, exact: true }), `Inbox hover should not offer "${name}"`).toHaveCount(0);
  }
  console.log(`Inbox: lists the email again (${back.total} emails)`);
  await takeScreenshot(page, script, '5-back-in-inbox');

  // Step 6: The opened email has the Inbox actions (opening marks it read: put it back to unread if it was)
  await backRow.click();
  await expect(page.getByRole('heading', { name: email.subject, level: 1 })).toBeVisible();
  const toolbar = emailToolbar(page);
  for (const name of ['Archive', 'Delete', 'Mark as Spam']) {
    await expect(toolbar.getByRole('button', { name, exact: true }), `Opened email should offer "${name}"`).toBeVisible();
  }
  for (const name of ['Move to inbox', 'Not Spam (Move to Inbox)', 'Delete Forever']) {
    await expect(toolbar.getByRole('button', { name, exact: true }), `Opened email should not offer "${name}"`).toHaveCount(0);
  }
  await takeScreenshot(page, script, '6-opened-in-inbox');
  if (!email.isRead) {
    const list = await openFolder(page, MAILBOX, 'Inbox');
    const row = await rowFor(page, list, email);
    await row.hover();
    const [response] = await Promise.all([
      page.waitForResponse(res => res.url().endsWith(`/api/emails/${email.id}/read`) && res.request().method() === 'PATCH'),
      row.getByRole('button', { name: 'Mark as unread', exact: true }).click(),
    ]);
    expect(response.ok(), 'The email should be put back to unread').toBeTruthy();
  }

  // Step 7: After a reload the email is still in the Inbox, read or unread as before, and not in the folder
  await page.reload();
  await useMailbox(page, MAILBOX);
  const folderAfterReload = await openFolder(page, MAILBOX, folder);
  expect(idsOf(folderAfterReload), `${folder} should not list the email after a reload`).not.toContain(email.id);
  const inboxAfterReload = await openFolder(page, MAILBOX, 'Inbox');
  await expect(await rowFor(page, inboxAfterReload, email)).toHaveText(rowText, { useInnerText: true });
  expect(inboxAfterReload.emails.find(item => item.id === email.id).isRead, 'Read or unread as before').toBe(email.isRead);
  console.log('After a reload the email is still in the Inbox, as before');
}

/**
 * Deletes a test email forever from Trash with the Delete Forever button of the opened email: Cancel on the question
 * keeps it, OK deletes it for good, and it does not come back on the next sync with the mail server.
 * @param {import('@playwright/test').Page} page
 */
async function deleteForever(page) {
  const script = 'DeleteForever';
  await startInMail(page);

  // Step 1: A test email in Trash
  const email = await testEmailInTrash(page, script);

  // Step 2: Trash lists it and shows Empty Trash; the hover buttons offer Move to inbox and Delete
  const inTrash = await openFolder(page, MAILBOX, 'Trash');
  const sameSubject = inTrash.emails.filter(item => item.subject === email.subject).length;
  const row = await rowFor(page, inTrash, email);
  await expectCount(page, inTrash.total);
  await expect(page.getByRole('button', { name: 'Empty Trash' })).toBeVisible();
  await row.hover();
  await expect(row.getByRole('button', { name: 'Move to inbox', exact: true })).toBeVisible();
  await expect(row.getByRole('button', { name: 'Delete', exact: true })).toBeVisible();
  console.log(`Trash: lists "${email.subject}" (${inTrash.total} emails)`);
  await takeScreenshot(page, script, '1-in-trash');

  // Step 3: The opened email offers Delete Forever (and Move to inbox) instead of Delete
  await row.click();
  await expect(page.getByRole('heading', { name: email.subject, level: 1 })).toBeVisible();
  const toolbar = emailToolbar(page);
  const deleteForeverButton = toolbar.getByRole('button', { name: 'Delete Forever', exact: true });
  await expect(deleteForeverButton).toBeVisible();
  await expect(toolbar.getByRole('button', { name: 'Move to inbox', exact: true })).toBeVisible();
  await expect(toolbar.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
  await takeScreenshot(page, script, '2-opened-in-trash');

  // Step 4: Delete Forever, then Cancel on the question: nothing is deleted and Trash still lists the email
  const deleteCalls = [];
  const onRequest = req => {
    if (req.method() === 'DELETE' && req.url().endsWith(`/api/emails/${email.id}`)) deleteCalls.push(req.url());
  };
  page.on('request', onRequest);
  const cancelled = await answerConfirm(page, false, () => deleteForeverButton.click());
  expect(cancelled, 'Delete Forever should ask before deleting').toEqual({ type: 'confirm', message: DELETE_FOREVER_QUESTION });
  await page.waitForTimeout(2000); // give a wrong delete call time to show up
  page.off('request', onRequest);
  expect(deleteCalls, 'Cancel should not delete the email').toEqual([]);
  const afterCancel = await openFolder(page, MAILBOX, 'Trash');
  const rowAfterCancel = await rowFor(page, afterCancel, email);
  console.log('Delete Forever + Cancel: the email stays in Trash');

  // Step 5: Delete Forever, then OK: the email is deleted and leaves the Trash list
  await rowAfterCancel.click();
  await expect(page.getByRole('heading', { name: email.subject, level: 1 })).toBeVisible();
  let answered;
  const [response] = await Promise.all([
    page.waitForResponse(res => res.url().endsWith(`/api/emails/${email.id}`) && res.request().method() === 'DELETE'),
    answerConfirm(page, true, () => emailToolbar(page).getByRole('button', { name: 'Delete Forever', exact: true }).click())
      .then(question => { answered = question; }),
  ]);
  expect(answered).toEqual({ type: 'confirm', message: DELETE_FOREVER_QUESTION });
  expect(response.status(), 'Delete Forever should succeed').toBe(200);
  expect((await response.json()).data).toBe('Email permanently deleted');
  await expect(page, 'Should go back to the Trash list').toHaveURL(/folder=trash/);
  await expect(emailRows(page).filter({ hasText: email.subject }), 'The email should leave the Trash list')
    .toHaveCount(sameSubject - 1);
  await takeScreenshot(page, script, '3-after-delete-forever');

  // Step 6: No folder lists it any more
  const trashAfter = await openFolder(page, MAILBOX, 'Trash');
  await expectCount(page, trashAfter.total);
  await expectInNoFolder(page, email);

  // Step 7: It does not come back when the mailbox syncs with the mail server, also after a reload
  await syncMailbox(page);
  await page.reload();
  await useMailbox(page, MAILBOX);
  const trashAfterSync = await openFolder(page, MAILBOX, 'Trash');
  expect(trashAfterSync.emails.filter(item => item.subject === email.subject).length,
    'The email should not come back after a sync').toBe(sameSubject - 1);
  await expectCount(page, trashAfterSync.total);
  console.log('Deleted forever: no folder lists the email, also after a sync and a reload');
  await takeScreenshot(page, script, '4-trash-after-sync');
}

/**
 * Empties Trash with the Empty Trash button and checks the Trash is empty for good.
 * Empty Trash deletes every email in Trash at once (it does not ask first), so the button is only clicked when Trash
 * holds nothing but test emails; when it holds other emails the test is skipped and they are kept.
 * @param {import('@playwright/test').Page} page
 */
async function emptyTrash(page) {
  const script = 'EmptyTrash';
  await startInMail(page);

  // Step 1: A test email in Trash
  const email = await testEmailInTrash(page, script);

  // Step 2: Trash holds only test emails. Other scripts put an email in Trash for a few seconds, so wait up to a
  // minute; when other emails are still there, skip the test and keep them
  let trash;
  await expect.poll(async () => {
    trash = await openFolder(page, MAILBOX, 'Trash');
    return trash.total === trash.emails.length && trash.emails.every(isTestEmail);
  }, { timeout: 60000, intervals: [5000] }).toBe(true).catch(() => {});
  const others = trash.emails.filter(item => !isTestEmail(item)).map(item => `"${item.subject}"`);
  test.skip(others.length > 0 || trash.total !== trash.emails.length,
    `Trash holds emails that are not test emails (${others.join(', ')}); Empty Trash would delete them for good`);
  expect(idsOf(trash), 'Trash should list the test email').toContain(email.id);
  await expectCount(page, trash.total);
  const emptyButton = page.getByRole('button', { name: 'Empty Trash' });
  await expect(emptyButton).toBeVisible();
  await rowFor(page, trash, email);
  console.log(`Trash: ${trash.total} test email(s)`);
  await takeScreenshot(page, script, '1-trash-before');

  // Step 3: Empty Trash (accept the question if one is asked)
  let question = null;
  const onDialog = async dialog => { question = dialog.message(); await dialog.accept(); };
  page.on('dialog', onDialog);
  const [response] = await Promise.all([
    page.waitForResponse(res => res.url().endsWith('/api/emails/trash/all') && res.request().method() === 'DELETE'),
    emptyButton.click(),
  ]);
  page.off('dialog', onDialog);
  expect(response.status(), 'Empty Trash should succeed').toBe(200);
  expect((await response.json()).success).toBe(true);
  console.log(question ? `Empty Trash asked: "${question}"` : 'Empty Trash did not ask before deleting');

  // Step 4: Trash is empty: "Nothing here", no Empty Trash button (Trash is emptied in the background)
  await expect.poll(async () => (await openFolder(page, MAILBOX, 'Trash')).total,
    { message: 'Trash should be empty', timeout: 60000, intervals: [3000] }).toBe(0);
  await expectCount(page, 0);
  await expect(emptyButton, 'Empty Trash should be hidden when Trash is empty').toBeHidden();
  await takeScreenshot(page, script, '2-trash-emptied');

  // Step 5: No folder lists the email, and Trash stays empty when the mailbox syncs with the mail server
  await expectInNoFolder(page, email);
  await syncMailbox(page);
  await page.reload();
  await useMailbox(page, MAILBOX);
  const afterSync = await openFolder(page, MAILBOX, 'Trash');
  expect(afterSync.emails.map(item => item.subject), 'Trash should stay empty after a sync').toEqual([]);
  await expectCount(page, 0);
  await expect(page.getByRole('button', { name: 'Empty Trash' })).toBeHidden();
  console.log('Trash emptied: it stays empty after a sync and a reload');
  await takeScreenshot(page, script, '3-trash-after-sync');
}

// Logs in and opens Mail with the mailbox selected. Right after login, wait for the Deals page: a sidebar click
// before that is lost.
async function startInMail(page) {
  await loginStaging(page);
  await expect(page).toHaveURL(/\/deals/, { timeout: 30000 });
  await openMail(page);
  await useMailbox(page, MAILBOX);
}

// Returns a test email that the mail server has in Trash: one already there, or else a test email from the Inbox (a new
// one is sent when there is none) is deleted to Trash. Waits for the mail server each time, because deleting an email
// forever before the server has it in Trash lets it come back on the next sync.
async function testEmailInTrash(page, script) {
  const trash = await openFolder(page, MAILBOX, 'Trash');
  const inTrash = trash.emails.find(item => isTestEmail(item) && item.uid != null);
  if (inTrash) {
    console.log(`Using the test email "${inTrash.subject}" already in Trash`);
    return inTrash;
  }

  const inbox = await openFolder(page, MAILBOX, 'Inbox');
  let email = inbox.emails.find(item => isTestEmail(item) && isInboxEmail(item));
  if (email) {
    console.log(`Using the test email "${email.subject}" in the Inbox`);
  } else {
    const subject = await sendTestEmail(page, script);
    email = await waitForMailServer(page, 'Inbox', item => item.subject === subject && isInboxEmail(item),
      'the test email to arrive in the Inbox');
  }
  const list = await openFolder(page, MAILBOX, 'Inbox');
  await clickRowButton(page, await rowFor(page, list, email), email, FOLDERS.Trash.moveIn);
  return waitForMailServer(page, 'Trash', item => item.subject === email.subject && item.uid != null,
    'the test email to be in Trash on the mail server');
}

// Sends a test email from the mailbox to itself. Returns its subject.
async function sendTestEmail(page, script) {
  const time = new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const subject = `${TEST_SUBJECT} ${script} ${time}`;

  await page.getByRole('button', { name: 'Compose Mail' }).click();
  await expect(page.getByRole('heading', { name: 'New Message', level: 4 })).toBeVisible();
  const from = page.getByRole('combobox').filter({ hasText: '@' }).first();
  if (!(await from.innerText()).includes(MAILBOX)) {
    await from.click();
    await page.getByRole('option', { name: MAILBOX }).first().click();
  }
  await expect(from).toContainText(MAILBOX);

  // Recipient becomes a chip when Enter is pressed
  await page.getByPlaceholder('Add recipients...').fill(MAILBOX);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape'); // closes the suggestion list
  await expect(page.locator('label', { hasText: /^To$/ }).locator('xpath=..').getByText(MAILBOX, { exact: true })).toBeVisible();
  await page.getByPlaceholder("What's this about?").fill(subject);
  // Type above the signature (the email is not sent without a body)
  await page.locator('.ProseMirror p').first().click();
  await page.keyboard.type(BODY);

  const [sent] = await Promise.all([
    page.waitForResponse(res => res.url().endsWith('/api/emails/send') && res.request().method() === 'POST', { timeout: 60000 }),
    page.getByRole('button', { name: 'Send', exact: true }).click(),
  ]);
  expect(sent.ok(), `Send API returned ${sent.status()}`).toBeTruthy();
  expect(sent.request().postDataJSON()).toMatchObject({ from: MAILBOX, to: [MAILBOX], subject });
  await expect(page.getByRole('heading', { name: 'New Message', level: 4 }), 'Compose should close after sending').toBeHidden();
  console.log(`Sent the test email "${subject}" to ${MAILBOX}`);
  return subject;
}

// Syncs the mailbox until the folder lists an email that matches, and returns it
async function waitForMailServer(page, folder, match, what) {
  const start = Date.now();
  for (;;) {
    const email = (await openFolder(page, MAILBOX, folder)).emails.find(match);
    if (email) {
      console.log(`Waited ${Math.round((Date.now() - start) / 1000)}s for ${what}`);
      return email;
    }
    expect(Date.now() - start, `Timed out waiting for ${what}`).toBeLessThan(SYNC_TIMEOUT);
    await syncMailbox(page);
  }
}

// Syncs the mailbox with the mail server (Refresh button) and waits until the sync is done
async function syncMailbox(page) {
  const readStatus = async () =>
    (await (await page.request.get(`${BASE_URL}/api/emails/accounts/${ACCOUNT_ID}/sync-status`)).json()).data;
  const before = await readStatus();
  const [response] = await Promise.all([
    page.waitForResponse(res => res.url().endsWith(`/api/emails/accounts/${ACCOUNT_ID}/sync`) && res.request().method() === 'POST'),
    page.getByRole('button', { name: 'Refresh emails' }).click(),
  ]);
  expect(response.ok(), `Sync API returned ${response.status()}`).toBeTruthy();
  await expect.poll(async () => {
    const now = await readStatus();
    return now.syncStatus === 'completed' && now.completedAt !== before.completedAt;
  }, { timeout: 120000, intervals: [5000] }).toBe(true)
    .catch(() => console.log('The sync did not report it was done within 2 minutes'));
}

// Clicks a hover button of the email's row, checks the server saved it, and that the row leaves the open list
async function clickRowButton(page, row, email, { button, api }) {
  const text = await row.innerText();
  await row.hover();
  const [response] = await Promise.all([
    page.waitForResponse(res => res.url().endsWith(`/api/emails/${email.id}/${api}`) && res.request().method() === 'POST'),
    row.getByRole('button', { name: button, exact: true }).click(),
  ]);
  expect(response.status(), `"${button}" should succeed`).toBe(200);
  const body = await response.json();
  expect(body.success, `"${button}" should succeed`).toBe(true);
  console.log(`${button}: ${typeof body.data === 'string' ? body.data : body.message}`);
  // The row is taken out: the next email moves into its place, or the list is left empty
  await expect.poll(async () => (await row.count()) === 0 || (await row.innerText()) !== text,
    { message: `The email should leave the list after "${button}"` }).toBe(true);
}

// No folder lists the email: Trash, Inbox, Archive, Spam
async function expectInNoFolder(page, email) {
  for (const folder of ['Trash', 'Inbox', 'Archive', 'Spam']) {
    const list = await openFolder(page, MAILBOX, folder);
    expect(idsOf(list), `${folder} should not list the email`).not.toContain(email.id);
  }
}

// The row of the email in the open list (the rows are in the same order as the emails the list loaded).
// The list only draws the rows in view, so the email must be among the first ones.
async function rowFor(page, list, email) {
  const index = list.emails.findIndex(item => item.id === email.id);
  expect(index, `The list should have the email "${email.subject}"`).toBeGreaterThanOrEqual(0);
  expect(index, 'The email should be among the first rows of the list').toBeLessThan(8);
  const row = emailRows(page).nth(index);
  await expect(row).toContainText(email.subject);
  return row;
}

// The buttons above an opened email (Archive / Move to inbox, Delete / Delete Forever, Mark as read, Spam)
function emailToolbar(page) {
  return page.getByRole('button', { name: /^Mark as (un)?read$/ }).first().locator('xpath=..');
}

// Clicks something that opens the browser's confirm question, answers it (OK or Cancel), returns { type, message }
async function answerConfirm(page, accept, click) {
  let question = null;
  page.once('dialog', async dialog => {
    question = { type: dialog.type(), message: dialog.message() };
    if (accept) await dialog.accept(); else await dialog.dismiss();
  });
  await click();
  await expect.poll(() => question, { message: 'A confirm question should be asked' }).not.toBeNull();
  return question;
}

// A real Inbox email. Right after sending to the mailbox itself, the Inbox also lists the outgoing email for a while
// (folder SENT): it is not an Inbox email yet, the mail server delivers the Inbox copy minutes later.
function isInboxEmail(email) {
  return email.folder === 'INBOX';
}

function isTestEmail(email) {
  return email.subject.startsWith(`${TEST_SUBJECT} `);
}

function idsOf(list) {
  return list.emails.map(item => item.id);
}

async function takeScreenshot(page, script, step) {
  // animations: 'disabled' finishes the rows' fade-in, so the picture is not faded
  await page.screenshot({ path: `screenshots/EmailActions/${script}-${step}.png`, animations: 'disabled' });
}

module.exports = { moveBackToInbox, deleteForever, emptyTrash };
