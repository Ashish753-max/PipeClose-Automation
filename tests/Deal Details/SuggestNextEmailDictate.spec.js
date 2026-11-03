const path = require('path');
const { test, expect } = require('@playwright/test');
const { openNewDeal } = require('../common/dealDetails');

// Dictate in the deal email composer and in the "Review suggested email" popup.
// The microphone is a fake device playing dictation-sample.wav (spoken: SPOKEN below), so the
// transcription service receives real speech. Screenshots are saved in screenshots/Dictate/ whatever the result.
const SAMPLE = path.resolve(__dirname, '../common/dictation-sample.wav');
const SPOKEN = 'Hello, I would like to schedule a short call next week to discuss pricing.';
const HEARD = /schedule a short call next week/i;

test.use({
  permissions: ['microphone'],
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${SAMPLE}`],
  },
});

/**
 * Clicks Dictate inside scope, records for a few seconds, clicks Stop and checks the spoken text lands in the body.
 * @returns {Promise<string>} the transcribed text
 */
async function dictate(page, scope, label) {
  const shot = step => page.screenshot({ path: `screenshots/Dictate/${label}-${step}.png` });
  const body = scope.locator('.ProseMirror');
  await body.click();
  await body.press('ControlOrMeta+End'); // dictated text goes where the cursor is
  const before = await body.innerText();

  await scope.getByRole('button', { name: 'Dictate', exact: true }).click();
  const stop = scope.getByRole('button', { name: 'Stop', exact: true });
  await expect(stop, `${label}: Dictate should start recording`).toBeVisible();
  await page.waitForTimeout(6000); // the sample is about 5 seconds long
  await shot('1-recording');

  const [transcription] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/api/transcriptions') && r.request().method() === 'POST', { timeout: 60000 }),
    stop.click(),
  ]);
  const result = await transcription.json().catch(() => ({}));
  console.log(`[${label}] transcription ${transcription.status()}: "${result.data?.text}"`);
  await shot('2-after-stop');
  expect(transcription.status(), `${label}: transcription API returned ${transcription.status()}`).toBe(200);
  expect(result.data?.text, `${label}: transcription should match what was said`).toMatch(HEARD);

  await expect(scope.getByRole('button', { name: 'Dictate', exact: true }), `${label}: Dictate should be ready again`).toBeVisible();
  await expect(body, `${label}: dictated text should be in the email body`).toContainText(HEARD);
  const after = await body.innerText();
  expect(after.replace(/\s+/g, ''), `${label}: text already in the body should be kept`).toContain(before.replace(/\s+/g, ''));
  await shot('3-text-inserted');
  return result.data.text;
}

test('Deal details - Dictate in the email composer and the suggested email popup', async ({ page }) => {
  test.setTimeout(600000);
  await openNewDeal(page);
  const main = page.getByRole('main');
  await page.waitForTimeout(3000); // AI analysis re-renders the page when a deal is first opened

  // Deal email composer
  await dictate(page, main, 'composer');
  await main.locator('.ProseMirror').fill(''); // leave the composer empty for Suggest Next Email

  // Review suggested email popup
  const [suggest] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/api/ai/suggest') && r.request().method() === 'POST', { timeout: 240000 }),
    main.getByRole('button', { name: 'Suggest Next Email', exact: true }).click(),
  ]);
  if (suggest.status() !== 201) {
    const error = await suggest.text();
    console.log(`[popup] Suggest Next Email returned ${suggest.status()}: ${error}`);
    await expect(page.getByRole('alert').first()).toBeVisible().catch(() => {});
    await page.screenshot({ path: 'screenshots/Dictate/popup-suggest-failed.png' });
    throw new Error(`Suggest Next Email returned ${suggest.status()} (${error}), so the popup's Dictate could not be reached`);
  }
  const popup = page.getByTestId('compose-backdrop');
  await expect(popup.getByRole('heading', { name: 'Review suggested email' })).toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: 'screenshots/Dictate/popup-0-opened.png' });
  await dictate(page, popup, 'popup');

  // Close without sending
  await popup.getByRole('button', { name: 'Close' }).click();
  await expect(popup).toBeHidden();
});
