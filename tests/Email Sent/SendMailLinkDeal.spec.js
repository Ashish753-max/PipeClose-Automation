// Mail > ashish.rai@appnox.ai > Compose Mail: send an email to Vijay linked to a deal
//   1. Compose: To vijaysingh.appnox@gmail.com, a subject and a message
//   2. Link Deal: search the deals for "vijay" and pick the first one
//   3. Send: the email goes out linked to that deal
//   4. Sent folder: the opened email shows the linked deal, and View Deal opens that deal
// Many deals have the same name ("Vijay - Pipeclose Tech Deal"), so the deal is checked by its id.
// The email is real, so it says it is an automated test. Every run sends one to Vijay.
// Screenshots: screenshots/EmailSent/SendMailLinkDeal-*.png
const { test, expect } = require('@playwright/test');
const { loginStaging } = require('../common/createDeal');
const { openMail, useMailbox, openSent, emailRows } = require('../common/mail');

const MAILBOX = 'ashish.rai@appnox.ai';
const TO = 'vijaysingh.appnox@gmail.com';
const DEAL_SEARCH = 'vijay';

// Address part of a stored value, e.g. "Vijay Singh" <vijaysingh.appnox@gmail.com>
const addressOf = text => text.match(/[^\s<>"]+@[^\s<>"]+/)?.[0].toLowerCase() ?? text;
// The deal ids a send request or a saved email carries, in whichever deal field it uses (dealId, dealIds, ...)
const dealIdsIn = data => Object.entries(data || {}).filter(([key]) => /deal/i.test(key))
  .flatMap(([, value]) => [].concat(value ?? [])).map(String);

test('Send an email to Vijay linked to a deal', async ({ page }) => {
  test.setTimeout(240000);
  const time = new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const subject = `Link deal test ${time}`;
  const body = `Hi Vijay, this is an automated test of an email linked to a deal, from PipeClose (${time}). Please ignore.`;

  await loginStaging(page);
  await expect(page).toHaveURL(/\/deals/, { timeout: 30000 });
  await openMail(page);
  await useMailbox(page, MAILBOX);

  // The compose form and its parts
  await page.getByRole('button', { name: 'Compose Mail' }).first().click();
  const heading = page.getByRole('heading', { name: 'New Message', level: 4 });
  await expect(heading).toBeVisible();
  const form = heading.locator('xpath=ancestor::*[.//button[normalize-space()="Save Draft"]][1]');
  const fieldRow = label => form.locator('label', { hasText: new RegExp(`^${label}$`, 'i') }).locator('xpath=..');
  const send = form.getByRole('button', { name: 'Send', exact: true });

  await test.step('Compose: To, subject and message', async () => {
    const from = form.getByRole('combobox').filter({ hasText: '@' }).first();
    if (!(await from.innerText()).includes(MAILBOX)) {
      await from.click();
      await page.getByRole('option', { name: MAILBOX }).first().click();
    }
    await expect(from).toContainText(MAILBOX);

    // Recipient becomes a chip when Enter is pressed
    await page.getByPlaceholder('Add recipients...').fill(TO);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape'); // closes the suggestion list
    await expect(fieldRow('To').getByText(TO, { exact: true })).toBeVisible();
    await form.getByPlaceholder("What's this about?").fill(subject);

    // Type on the empty first line, above the signature. The editor can still be loading the signature, which can
    // wipe what was typed, so wait until it stops changing and type again if needed.
    const editor = form.locator('.ProseMirror').first();
    await expect(editor).toContainText('Best Regards');
    await expect.poll(async () => {
      const before = await editor.innerHTML();
      await page.waitForTimeout(1000);
      return before === await editor.innerHTML();
    }, { message: 'The editor should finish loading', timeout: 20000 }).toBe(true);
    const firstLine = editor.locator('p').first();
    await expect(firstLine, 'The message should start with an empty line above the signature').toHaveText('');
    await expect(async () => {
      await firstLine.click({ clickCount: 3 }); // selects the line, so a wiped attempt is typed over
      await page.keyboard.insertText(body);
      await expect(firstLine).toHaveText(body, { timeout: 2000 });
    }).toPass({ timeout: 30000 });
    await expect(send).toBeEnabled();
  });

  let deal; // the first deal the search found
  await test.step('Link Deal: search "vijay" and pick the first deal', async () => {
    await page.getByRole('button', { name: 'Link Deal' }).last().click();
    await expect(page.getByRole('heading', { name: 'Link Deal', level: 5 })).toBeVisible();
    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/deals/get?') && new URL(r.url()).searchParams.get('search') === DEAL_SEARCH,
        { timeout: 30000 }),
      page.getByPlaceholder('Search deals by name...').fill(DEAL_SEARCH),
    ]);
    expect(response.ok(), `Deal search returned ${response.status()}`).toBeTruthy();
    const { deals } = (await response.json()).data;
    expect(deals.length, `The search should find deals for "${DEAL_SEARCH}"`).toBeGreaterThan(0);
    for (const found of deals) expect(found.title.toLowerCase(), 'Each deal found should match the search').toContain(DEAL_SEARCH);
    deal = deals[0];
    console.log(`Deal search "${DEAL_SEARCH}": ${deals.length} deals; first is #${deal.id} "${deal.title}" (${deal.status})`);

    // The results list the deals in the same order: pick the first one
    const results = page.getByRole('button').filter({ has: page.getByRole('paragraph') }).filter({ hasText: /OPEN|WON|LOST/ });
    await expect(results.first()).toContainText(deal.title);
    await expect(results).toHaveCount(deals.length);
    await page.screenshot({ path: 'screenshots/EmailSent/SendMailLinkDeal-1-search.png' });
    await results.first().click();

    // The deal is shown as linked, and the Link Deal button now carries its name
    await expect(page.getByRole('button', { name: 'Remove linked deal' })).toBeVisible();
    await expect(page.getByRole('button', { name: deal.title })).toBeVisible();
    await page.screenshot({ path: 'screenshots/EmailSent/SendMailLinkDeal-2-linked.png' });
  });

  await test.step('Send: the email goes out linked to the deal', async () => {
    const [sent] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith('/api/emails/send') && r.request().method() === 'POST', { timeout: 60000 }),
      send.click(),
    ]);
    expect(sent.ok(), `Send API returned ${sent.status()}`).toBeTruthy();
    const request = sent.request().postDataJSON();
    console.log(`Send request: ${JSON.stringify({ ...request, body: undefined, htmlBody: undefined })}`);
    expect(request.from).toBe(MAILBOX);
    expect(request.to.map(addressOf)).toEqual([TO]);
    expect(request.subject).toBe(subject);
    expect(request.body).toContain(body);
    expect(dealIdsIn(request), `The email should be sent linked to deal #${deal.id}`).toContain(String(deal.id));
    await expect.soft(page.getByText('Your email has been sent successfully'), 'Success message should be shown')
      .toBeVisible({ timeout: 15000 });
    await expect(heading, 'Compose should close after sending').toBeHidden();
    console.log(`Sent "${subject}" to ${TO}, linked to deal #${deal.id}`);
  });

  await test.step('Sent folder: the email shows the linked deal', async () => {
    let email;
    await expect(async () => {
      const emails = await openSent(page, MAILBOX);
      email = emails.find(e => e.subject === subject);
      expect(email, 'The email should be listed in Sent').toBeTruthy();
    }).toPass({ timeout: 90000 });
    expect(email.to.map(addressOf)).toEqual([TO]);
    expect(email.isLinkedToDeal, 'Sent should keep the email linked to a deal').toBe(true);
    expect(dealIdsIn(email), `Sent should keep the link to deal #${deal.id}`).toContain(String(deal.id));

    const row = emailRows(page).filter({ hasText: subject });
    await expect(row, 'Sent should list the email once').toHaveCount(1);
    await page.screenshot({ path: 'screenshots/EmailSent/SendMailLinkDeal-3-sent.png' });

    await row.click();
    await expect(page.getByRole('heading', { name: subject, level: 1 })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(`to ${TO}`).last()).toBeVisible();
    await expect(page.locator('iframe').last().contentFrame().getByText(body)).toBeVisible({ timeout: 15000 });
    // "LINKED DEAL  Vijay - Pipeclose Tech Deal" with a View Deal button
    await expect(page.getByText(/^linked deal$/i), 'The email should show it is linked to a deal').toBeVisible();
    await expect(page.getByText(deal.title, { exact: true }).first()).toBeVisible();
    await page.screenshot({ path: 'screenshots/EmailSent/SendMailLinkDeal-4-sent-opened.png' });

    // View Deal opens the deal that was picked
    await page.getByRole('button', { name: 'View Deal' }).click();
    await expect(page, `View Deal should open deal #${deal.id}`).toHaveURL(new RegExp(`/deals/${deal.id}(?:[/?#]|$)`), { timeout: 30000 });
    // The deal page: the deal title as the main heading, and the person's fields
    await expect(page.getByRole('heading', { name: deal.title, level: 1 })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('First name', { exact: true })).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('heading', { name: subject, level: 1 }), 'The email should be left').toBeHidden();
    await page.screenshot({ path: 'screenshots/EmailSent/SendMailLinkDeal-5-deal.png' });
  });
});
