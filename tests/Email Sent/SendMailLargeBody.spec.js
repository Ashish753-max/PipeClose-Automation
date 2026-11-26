// Mail > ashish.rai@appnox.ai > Compose Mail: send a long, formatted email with To, Cc and Bcc, and check its format
//   1. Compose: To govind.singh@appnox.ai, Cc abhijeet.appnox@gmail.com, Bcc shivang.appnox@gmail.com, and a body of
//      12 long paragraphs (about 6,000 characters) with a bold sentence, a bullet list and a numbered list
//   2. Send: the whole body goes out, as HTML with the paragraphs, bold text and lists
//   3. Sent folder: the opened email shows every paragraph whole, separate and in order, the bold text, both lists and
//      the signature at the end: nothing is cut off, merged or lost
// The email is real, so it says it is an automated test. Every run sends one to all three addresses.
// Screenshots: screenshots/EmailSent/SendMailLargeBody-*.png
const { test, expect } = require('@playwright/test');
const { loginStaging } = require('../common/createDeal');
const { openMail, useMailbox, openSent, emailRows } = require('../common/mail');

const MAILBOX = 'ashish.rai@appnox.ai';
const TO = 'govind.singh@appnox.ai';
const CC = 'abhijeet.appnox@gmail.com';
const BCC = 'shivang.appnox@gmail.com';

// Address part of a stored value, e.g. "Govind Singh" <govind.singh@appnox.ai>
const addressOf = text => text.match(/[^\s<>"]+@[^\s<>"]+/)?.[0].toLowerCase() ?? text;
const addressesOf = list => (list || []).map(addressOf);
const normalize = text => text.replace(/\s+/g, ' ').trim();

// The body: each paragraph is long and numbered, so a cut, merged or missing one is easy to spot
const TOPICS = [
  'how the pipeline board shows every open deal by stage',
  'how leads are imported from a CSV file and checked for duplicates',
  'how activities such as calls, meetings and tasks are scheduled',
  'how the mailbox stays in sync with the mail server',
  'how campaigns send a sequence of emails to enrolled contacts',
  'how the AI reply drafts an answer from the email thread',
  'how the summarizer turns a long thread into key points',
  'how deals are marked as won or lost and reopened later',
  'how prospects are filtered by job title, location and company',
  'how reports show the deals won each month',
  'how notifications point to new emails and upcoming events',
  'how company settings and the knowledge base shape AI answers',
];
const paragraphs = TOPICS.map((topic, i) => `Paragraph ${i + 1} of ${TOPICS.length}: this part explains ${topic}. `
  + 'It is written as one long paragraph on purpose, so the test can check that the email keeps long text whole, '
  + 'wraps it inside the message instead of cutting it off, and keeps each paragraph apart from the next one. '
  + 'Numbers like 1,234.56 and 99%, symbols like & < > " and an address like test@example.com must arrive unchanged. '
  + `End of paragraph ${i + 1}.`);
const BOLD = 'This sentence is bold and must stay bold in the Sent folder.';
const BULLETS = ['First bullet: the email keeps bullet lists', 'Second bullet: each item stays on its own line', 'Third bullet: the order does not change'];
const NUMBERED = ['First step: write the email', 'Second step: send it with Cc and Bcc', 'Third step: check it in the Sent folder'];

test('Send a large, formatted email with Cc and Bcc and check its format in Sent', async ({ page }) => {
  test.setTimeout(300000);
  const time = new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const subject = `Large email body test ${time}`;
  const intro = `Hi team, this is an automated test of a long email from PipeClose (${time}). Please ignore.`;

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
  const input = label => fieldRow(label).locator('input');
  const chip = (label, address) => fieldRow(label).getByText(address, { exact: true });
  const send = form.getByRole('button', { name: 'Send', exact: true });
  const editor = form.locator('.ProseMirror').first();

  // Types an address in a field and presses Enter (it becomes a chip), then closes the suggestion list
  async function addAddress(label, address) {
    await input(label).fill(address);
    await input(label).press('Enter');
    await page.keyboard.press('Escape');
    await expect(chip(label, address), `${address} should be added to ${label}`).toHaveCount(1);
  }

  await test.step('Compose: To, Cc, Bcc and subject', async () => {
    const from = form.getByRole('combobox').filter({ hasText: '@' }).first();
    if (!(await from.innerText()).includes(MAILBOX)) {
      await from.click();
      await page.getByRole('option', { name: MAILBOX }).first().click();
    }
    await expect(from).toContainText(MAILBOX);
    await addAddress('To', TO);
    // Cc and Bcc open with the arrow button next to To
    await fieldRow('To').getByRole('button').last().click();
    await addAddress('Cc', CC);
    await addAddress('Bcc', BCC);
    await form.getByPlaceholder("What's this about?").fill(subject);
  });

  await test.step('Compose: a long body with bold text and lists', async () => {
    // Start on the empty first line, above the signature. The editor can still be loading the signature, which can
    // wipe what was typed, so wait until it stops changing and type the first line again if needed.
    await expect(editor).toContainText('Best Regards');
    await expect.poll(async () => {
      const before = await editor.innerHTML();
      await page.waitForTimeout(1000);
      return before === await editor.innerHTML();
    }, { message: 'The editor should finish loading', timeout: 20000 }).toBe(true);
    const firstLine = editor.locator('p').first();
    await expect(firstLine, 'The message should start with an empty line above the signature').toHaveText('');
    await expect(async () => {
      await firstLine.click();
      await page.keyboard.press('Control+Home');
      await page.keyboard.press('Shift+End'); // replaces what a wiped attempt left on the line
      await page.keyboard.insertText(intro);
      await expect(firstLine).toHaveText(intro, { timeout: 2000 });
    }).toPass({ timeout: 30000 });
    await page.keyboard.press('End');

    const newParagraph = () => page.keyboard.press('Enter');
    for (const text of paragraphs.slice(0, 6)) {
      await newParagraph();
      await page.keyboard.insertText(text);
    }
    // A bold sentence (Ctrl+B on and off)
    await newParagraph();
    await page.keyboard.press('Control+b');
    await page.keyboard.insertText(BOLD);
    await page.keyboard.press('Control+b');
    // A bullet list ("- " starts it) and a numbered list ("1. " starts it); an empty item (Enter twice) ends a list
    await newParagraph();
    await page.keyboard.type('- ');
    for (const [i, item] of BULLETS.entries()) {
      if (i) await newParagraph();
      await page.keyboard.insertText(item);
    }
    await newParagraph();
    await newParagraph();
    await page.keyboard.type('1. ');
    for (const [i, item] of NUMBERED.entries()) {
      if (i) await newParagraph();
      await page.keyboard.insertText(item);
    }
    await newParagraph();
    await newParagraph();
    await page.keyboard.insertText(paragraphs[6]);
    for (const text of paragraphs.slice(7)) {
      await newParagraph();
      await page.keyboard.insertText(text);
    }

    // The editor holds the whole body, formatted, above the signature
    await expect(editor.locator('strong, b').filter({ hasText: BOLD })).toHaveCount(1);
    await expect(editor.locator('ul > li')).toHaveText(BULLETS);
    await expect(editor.locator('ol > li')).toHaveText(NUMBERED);
    for (const text of paragraphs) await expect(editor.locator('p').filter({ hasText: text })).toHaveCount(1);
    const editorText = normalize(await editor.innerText());
    expect(editorText.indexOf('Best Regards'), 'The signature should stay below the body')
      .toBeGreaterThan(editorText.indexOf(`End of paragraph ${TOPICS.length}.`));
    await expect(send).toBeEnabled();
    await editor.locator('p').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'screenshots/EmailSent/SendMailLargeBody-1-compose.png' });
  });

  await test.step('Send: the whole body goes out, formatted', async () => {
    const [sent] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith('/api/emails/send') && r.request().method() === 'POST', { timeout: 60000 }),
      send.click(),
    ]);
    expect(sent.ok(), `Send API returned ${sent.status()}`).toBeTruthy();
    const request = sent.request().postDataJSON();
    expect(addressesOf(request.to), 'To').toEqual([TO]);
    expect(addressesOf(request.cc), 'Cc').toEqual([CC]);
    expect(addressesOf(request.bcc), 'Bcc').toEqual([BCC]);
    expect(request.subject).toBe(subject);
    const plain = normalize(request.body);
    for (const text of [intro, ...paragraphs, BOLD, ...BULLETS, ...NUMBERED]) {
      expect(plain, `The text body should contain "${text.slice(0, 40)}..."`).toContain(normalize(text));
    }
    expect(request.htmlBody, 'The HTML body should keep the bold text').toMatch(new RegExp(`<(strong|b)>${BOLD}</(strong|b)>`));
    expect(request.htmlBody, 'The HTML body should keep the bullet list').toContain('<ul');
    expect(request.htmlBody, 'The HTML body should keep the numbered list').toContain('<ol');
    console.log(`Sent "${subject}": ${request.body.length} characters of text, ${request.htmlBody.length} of HTML`);
    await expect.soft(page.getByText('Your email has been sent successfully'), 'Success message should be shown')
      .toBeVisible({ timeout: 15000 });
    await expect(heading, 'Compose should close after sending').toBeHidden();
  });

  await test.step('Sent folder: the email is listed with the same To, Cc and Bcc', async () => {
    let email;
    await expect(async () => {
      const emails = await openSent(page, MAILBOX);
      email = emails.find(e => e.subject === subject);
      expect(email, 'The email should be listed in Sent').toBeTruthy();
    }).toPass({ timeout: 90000 });
    expect(addressesOf(email.to), 'To in Sent').toEqual([TO]);
    expect(addressesOf(email.cc), 'Cc in Sent').toEqual([CC]);
    expect(addressesOf(email.bcc), 'Bcc in Sent').toEqual([BCC]);
    expect(normalize(email.body), 'Sent should keep the whole body').toContain(`End of paragraph ${TOPICS.length}.`);

    const row = emailRows(page).filter({ hasText: subject });
    await expect(row, 'Sent should list the email once').toHaveCount(1);
    await expect(row.getByRole('heading', { level: 4 })).toContainText(TO);
    await expect(row, 'The preview should start with the first line of the body').toContainText(intro.slice(0, 40));
    await page.screenshot({ path: 'screenshots/EmailSent/SendMailLargeBody-2-sent.png' });

    await row.click();
    await expect(page.getByRole('heading', { name: subject, level: 1 })).toBeVisible({ timeout: 30000 });
    const recipients = page.getByText(new RegExp(`^to ${TO.replace(/\./g, '\\.')}`)).last();
    await expect(recipients).toContainText(`cc: ${CC}`);
    await expect(recipients).toContainText(`bcc: ${BCC}`);
  });

  await test.step('Sent folder: the opened email keeps the format', async () => {
    // The email body is drawn in an iframe
    const body = page.locator('iframe').last().contentFrame();
    await expect(body.getByText(intro), 'The first line should be shown').toBeVisible({ timeout: 15000 });

    // Every paragraph is shown whole and on its own: not cut off, not merged with the next one
    for (const text of paragraphs) {
      await expect(body.locator('p').filter({ hasText: text.slice(0, 30) }), `"${text.slice(0, 30)}..." should be one whole paragraph`)
        .toHaveText(text);
    }
    await expect(body.locator('strong, b').filter({ hasText: BOLD }), 'The bold sentence should stay bold').toHaveCount(1);
    await expect(body.locator('ul > li'), 'The bullet list should keep its items').toHaveText(BULLETS);
    await expect(body.locator('ol > li'), 'The numbered list should keep its items').toHaveText(NUMBERED);

    // Everything is in the order it was written, with the signature at the end
    const shown = normalize(await body.locator('body').innerText());
    const order = [intro, ...paragraphs.slice(0, 6), BOLD, ...BULLETS, ...NUMBERED, ...paragraphs.slice(6), 'Best Regards']
      .map(text => shown.indexOf(normalize(text)));
    expect(order, 'Every part should be shown once').not.toContain(-1);
    expect(order, 'The parts should be in the order they were written').toEqual([...order].sort((a, b) => a - b));
    console.log(`Opened in Sent: ${paragraphs.length} paragraphs, bold text, ${BULLETS.length} bullets and ${NUMBERED.length} numbered items, in order`);

    await page.screenshot({ path: 'screenshots/EmailSent/SendMailLargeBody-3-sent-top.png' });
    await body.locator('ul').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'screenshots/EmailSent/SendMailLargeBody-4-sent-lists.png' });
    await body.getByText('Best Regards').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'screenshots/EmailSent/SendMailLargeBody-5-sent-end.png' });
  });
});
