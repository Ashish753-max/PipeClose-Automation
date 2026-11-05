const { test, expect } = require('@playwright/test');
const { findLayoutProblems, findCutOffPlaceholders, findClippedText, isTruncated } = require('../common/responsive');
const {
  UNREGISTERED_EMAIL, openLogin, knownDefect, toast, loginForm, submitLogin,
  signUpForm, fillAccount, clickNext, goToStep2,
} = require('../common/authPages');

// Log in and Sign up pages on phone, tablet and desktop screens.
// On each screen: the page does not scroll sideways, nothing is cut off or covered, text is readable,
// the form is centred with its boxes lined up, every box and button can be reached, error messages
// and dropdown lists stay on screen, and step 2 of Sign up is one column on phones and two from 768px.
// Checks are soft, so a test lists every problem it finds, not only the first.
// Small tap targets (under 24px) are listed as notes on the test in the report, not failures.
// Screenshots are saved in screenshots/Auth-Responsive/ as proof.

const SCREENS = [
  { name: 'small-phone', width: 320, height: 568, mobile: true }, // iPhone SE (1st gen), smallest common phone
  { name: 'phone', width: 390, height: 844, mobile: true }, // iPhone 12 to 15
  { name: 'phone-landscape', width: 844, height: 390, mobile: true },
  { name: 'tablet', width: 768, height: 1024, mobile: true }, // iPad mini, upright
  { name: 'laptop', width: 1366, height: 768, mobile: false },
  { name: 'desktop', width: 1920, height: 1080, mobile: false },
];

// ---------------------------------------------------------------- Layout checks

async function expectFitsScreen(page, label) {
  const problems = await page.evaluate(findLayoutProblems);
  expect.soft(problems.pageScroll, `${label}: the page should not scroll sideways`).toBeLessThanOrEqual(0);
  expect.soft(problems.cutOff, `${label}: controls cut off at the screen edge`).toEqual([]);
  expect.soft(problems.covered, `${label}: controls covered by something else`).toEqual([]);
  expect.soft(problems.tinyText, `${label}: text smaller than 12px`).toEqual([]);
  if (problems.small.length) {
    test.info().annotations.push({ type: 'small tap target', description: `${label}: ${problems.small.join(', ')}` });
  }
}

const screenWidth = page => page.evaluate(() => document.documentElement.clientWidth);

// The element's box once it stops moving (message boxes slide in from the right for 0.3 s)
async function settledBox(page, locator) {
  let last = await locator.boundingBox();
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(100);
    const box = await locator.boundingBox();
    if (box && last && box.x === last.x && box.width === last.width) return box;
    last = box;
  }
  return last;
}

// The element is wholly inside the screen from left to right
async function expectInsideScreenWidth(page, locator, label) {
  await expect(locator, `${label} should show`).toBeVisible();
  const box = await settledBox(page, locator);
  const width = await screenWidth(page);
  expect.soft(box.x, `${label} should not start off the left edge`).toBeGreaterThanOrEqual(0);
  expect.soft(box.x + box.width, `${label} should not run off the right edge (${width}px)`).toBeLessThanOrEqual(width);
}

// The logo and "Back to website" sit side by side without overlapping
async function expectHeaderClear(page) {
  const logo = await page.getByRole('link', { name: 'PipeClose Home' }).boundingBox();
  const back = await page.getByRole('link', { name: 'Back to website' }).boundingBox();
  expect.soft(logo.x + logo.width, 'The logo should end before "Back to website" starts').toBeLessThanOrEqual(back.x);
}

// The boxes and button share the same left edge and width, and the form is centred on the screen
async function expectFormAligned(page, controls, label) {
  const boxes = await Promise.all(controls.map(control => control.boundingBox()));
  const [first] = boxes;
  boxes.forEach((box, i) => {
    expect.soft(Math.abs(box.x - first.x), `${label}: control ${i + 1} should line up on the left`).toBeLessThanOrEqual(1);
    expect.soft(Math.abs(box.width - first.width), `${label}: control ${i + 1} should be as wide as the others`).toBeLessThanOrEqual(1);
  });
  const leftGap = first.x;
  const rightGap = await screenWidth(page) - (first.x + first.width);
  expect.soft(Math.abs(leftGap - rightGap), `${label}: the form should be centred (gaps ${leftGap} and ${rightGap})`).toBeLessThanOrEqual(2);
}

// Scrolling to the control brings it fully on screen
async function expectReachable(locator, label) {
  await locator.scrollIntoViewIfNeeded();
  await expect.soft(locator, `${label} should be on screen once scrolled to`).toBeInViewport({ ratio: 1 });
}

// A tap on the middle of the control reaches it (nothing on top of it)
async function expectNotCovered(locator, label) {
  const reached = await locator.evaluate(el => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!top && (el.contains(top) || top.contains(el));
  });
  expect.soft(reached, `${label} should not be covered`).toBe(true);
}

// The button's text fits inside it
async function expectTextFits(locator, label) {
  expect.soft(await isTruncated(locator), `${label}: the text should fit in the button`).toBe(false);
}

// ---------------------------------------------------------------- Tests

for (const screen of SCREENS) {
  test.describe(`${screen.name} ${screen.width}x${screen.height}`, () => {
    test.use({
      viewport: { width: screen.width, height: screen.height },
      isMobile: screen.mobile,
      hasTouch: screen.mobile,
    });
    const shot = (page, step) => page.screenshot({ path: `screenshots/Auth-Responsive/${screen.name}-${step}.png`, fullPage: true });

    test('Log in page fits the screen', async ({ page }) => {
      await openLogin(page);
      const form = loginForm(page);
      await expectFitsScreen(page, 'Log in');
      await expectHeaderClear(page);
      await expectFormAligned(page, [form.email, form.password, form.logIn], 'Log in');
      await expectTextFits(form.logIn, 'Log in');
      for (const [name, control] of Object.entries(form)) await expectReachable(control, name);
      await shot(page, '01-login');
    });

    test('Log in error message stays on screen and off the form', async ({ page }) => {
      await openLogin(page);
      await submitLogin(page, UNREGISTERED_EMAIL, 'Test@1234');
      const message = toast(page, 'Login Failed');
      await expect(message).toBeVisible();
      await expectInsideScreenWidth(page, message, 'The "Login Failed" message');
      await expectNotCovered(loginForm(page).logIn, 'Log in, while the message shows,');
      await shot(page, '02-login-error');
    });

    test('Sign up step 1 fits the screen', async ({ page }) => {
      await openLogin(page);
      await loginForm(page).signUp.click();
      const form = signUpForm(page);
      await form.fullName.waitFor();
      await expectFitsScreen(page, 'Sign up step 1');
      await expectHeaderClear(page);
      await expectFormAligned(page, [form.fullName, form.email, form.password, form.next], 'Sign up step 1');
      await expectTextFits(form.next, 'Next');
      for (const [name, control] of Object.entries({
        'Full name': form.fullName, Email: form.email, Password: form.password, 'Country code': form.countryCode,
        'Phone number': form.phone, Next: form.next, 'Log in': form.logIn,
      })) await expectReachable(control, name);
      await shot(page, '03-signup-step1');

      // An error message stays on screen
      await fillAccount(page, { password: 'weak' });
      await clickNext(page);
      await expectInsideScreenWidth(page, toast(page, 'Invalid Password'), 'The "Invalid Password" message');
    });

    test('Sign up step 2 fits the screen and is one column on phones', async ({ page }) => {
      await openLogin(page);
      await loginForm(page).signUp.click();
      await goToStep2(page);
      const form = signUpForm(page);
      await expectFitsScreen(page, 'Sign up step 2');

      const name = await form.companyName.boundingBox();
      const location = await form.location.boundingBox();
      const twoColumns = Math.abs(name.y - location.y) < 2;
      expect.soft(twoColumns, screen.width >= 768 ? 'Company name and location should sit side by side'
        : 'Company name and location should be one under the other').toBe(screen.width >= 768);

      // Back and Create Account side by side, both reachable, text fitting
      await expectReachable(form.createAccount, 'Create Account');
      await expectReachable(form.back, 'Back');
      const back = await form.back.boundingBox();
      const create = await form.createAccount.boundingBox();
      expect.soft(Math.abs(back.y - create.y), 'Back and Create Account should be on one row').toBeLessThan(2);
      await expectTextFits(form.createAccount, 'Create Account');
      await shot(page, '04-signup-step2');

      // The Industry list stays on screen and its last option can be reached
      await page.getByRole('button', { name: 'Select industry*' }).click();
      const lastIndustry = page.getByText('Other', { exact: true }).last();
      await expectReachable(lastIndustry, 'The last industry, Other,');
      await expectInsideScreenWidth(page, lastIndustry, 'The Industry list');
      await shot(page, '05-industry-list');
      await lastIndustry.click();

      // The location suggestions stay on screen
      await form.location.fill('Bengaluru');
      const suggestion = page.getByRole('button', { name: /Bengaluru, Karnataka, India/ }).first();
      await suggestion.waitFor({ timeout: 20000 });
      await expectInsideScreenWidth(page, suggestion, 'The location suggestions');
      await shot(page, '06-location-suggestions');
      await suggestion.click();
    });

    test('text and placeholders show in full', async ({ page }) => {
      if (screen.width <= 320) {
        knownDefect('On a 320px wide screen the form is only 190px wide (the card keeps 48px of padding on each side), ' +
          'so "Phone number", "Company location*" and "Select company size*" are cut short (the last without "...")');
      }
      const expectNothingCut = async label => {
        expect.soft(await page.evaluate(findCutOffPlaceholders), `${label}: placeholders cut short`).toEqual([]);
        expect.soft(await page.evaluate(findClippedText), `${label}: text cut off`).toEqual([]);
      };
      await openLogin(page);
      await expectNothingCut('Log in');
      await loginForm(page).signUp.click();
      await signUpForm(page).fullName.waitFor();
      await expectNothingCut('Sign up step 1');
      await goToStep2(page);
      await expectNothingCut('Sign up step 2');
    });
  });
}
