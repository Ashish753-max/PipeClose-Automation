// tests/common/authPages.js
// Helpers for the Log in and Sign up tests in tests/Login/.
// Log in is at /login. Sign up is at /register and has two steps:
//   step 1 - your details: Full name, Email, Password, Phone number, then "Next"
//   step 2 - company details: Company name, Industry, Company size, Location, Website, Time zone, Description,
//            then "Create Account" (the only button that sends anything to the server)
const { expect, test } = require('@playwright/test');
const loginConfig = require('./loginConfig');

const BASE_URL = 'https://staging.pipeclose.com';

// An email no account uses
const UNREGISTERED_EMAIL = 'no.account.qa.automation@example.com';

// Valid sign up details. The email is the test account's, which already has an account, so the server
// refuses Create Account with "User already exists" and no account is made.
// The server only looks for an existing account once every field has passed its checks,
// so getting "User already exists" proves all the details were accepted.
const VALID_ACCOUNT = { name: 'QA Automation', email: loginConfig.email, password: 'Test@1234', phone: '2015550123' };
const VALID_COMPANY = { name: 'QA Automation Co', industry: 'Technology / SaaS', size: '1 – 10', location: 'Bengaluru' };

const INDUSTRIES = ['Technology / SaaS', 'Finance / FinTech', 'Healthcare', 'E-commerce', 'Education',
  'Marketing / Advertising', 'Real Estate', 'Manufacturing', 'Consulting', 'Other'];
// Each size is shown with a short description under it, e.g. "1 – 10" over "Solo / micro team"
const COMPANY_SIZES = ['1 – 10', '11 – 50', '51 – 200', '201 – 500', '501 – 1,000', '1,000+'];

// ---------------------------------------------------------------- Opening the pages

async function openPage(page, path) {
  // Say no to analytics cookies up front, so the cookie banner (shown about 5 s after load) does not
  // cover the form. If it shows anyway, it is closed before the next click.
  await page.context().addCookies([{ name: 'pc_analytics_consent', value: 'denied', url: BASE_URL }]);
  await page.addLocatorHandler(page.getByRole('button', { name: 'Reject', exact: true }), button => button.click());

  // Safety net: a sign up with a valid email that has no account yet would make a real account,
  // so it is stopped before it reaches the server (the test that sent it then fails).
  // Allowed: the test account's email (refused as "User already exists") and emails the server refuses as invalid.
  // Set CREATE_TEST_ACCOUNT=1 to let the one test that makes a new account through.
  await page.route('**/api/auth/register', route => {
    const email = (route.request().postDataJSON()?.userData?.email || '').trim().toLowerCase();
    const looksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (looksValid && email !== loginConfig.email.toLowerCase() && !process.env.CREATE_TEST_ACCOUNT) {
      return route.abort('blockedbyclient');
    }
    return route.fallback();
  });

  // Staging sometimes drops a page load when many tests start at once: try once more on a network error
  await page.goto(BASE_URL + path, { waitUntil: 'domcontentloaded' }).catch(error => {
    if (!/net::ERR_/.test(error.message)) throw error;
    return page.goto(BASE_URL + path, { waitUntil: 'domcontentloaded' });
  });
  await page.getByPlaceholder('Email').waitFor({ timeout: 60000 });
}

// Marks a test that checks a known defect. It passes while the defect is there, and Playwright reports it
// ("expected to fail") once the defect is fixed, so the mark can be removed.
// Run with SHOW_DEFECTS=1 to make these tests fail and show what is wrong in the report.
function knownDefect(description) {
  test.info().annotations.push({ type: 'known defect', description });
  test.fail(!process.env.SHOW_DEFECTS, description);
}

const openLogin = page => openPage(page, '/login');
const openSignUp = page => openPage(page, '/register');

// ---------------------------------------------------------------- Shared checks

// A message box at the top right, found by its title, e.g. toast(page, 'Login Failed').
// It holds the title, the message under it and the close button, and closes by itself after about 3 s.
function toast(page, title) {
  return page.locator('div')
    .filter({ has: page.getByRole('heading', { name: title, exact: true, level: 3 }) })
    .filter({ has: page.getByRole('button') })
    .last();
}

// The browser's own check of a box: is it filled, does it look like an email, and the message it shows
function browserCheck(field) {
  return field.evaluate(el => ({
    valid: el.validity.valid,
    empty: el.validity.valueMissing,
    notAnEmail: el.validity.typeMismatch,
    message: el.validationMessage,
  }));
}

// Starts noting requests to the server path, e.g. '/api/auth/login'. After the action, call expectNone():
// it gives a request time to start, then checks none was sent.
// Check message boxes before expectNone(): they close by themselves after about 2 s.
function watchRequests(page, apiPath) {
  const sent = [];
  const watch = request => { if (request.url().includes(apiPath)) sent.push(request.url()); };
  page.on('request', watch);
  return {
    async expectNone() {
      await page.waitForTimeout(1500);
      page.off('request', watch);
      expect(sent, `Nothing should be sent to ${apiPath}`).toEqual([]);
    },
  };
}

// Runs the action and checks nothing was sent to the server path
async function expectNothingSent(page, apiPath, action) {
  const requests = watchRequests(page, apiPath);
  await action();
  await requests.expectNone();
}

// The button that shows or hides the password: the only button in the password box
function showPasswordButton(page) {
  return page.locator('div').filter({ has: page.getByPlaceholder('Password') }).last().getByRole('button');
}

// ---------------------------------------------------------------- Log in

function loginForm(page) {
  return {
    email: page.getByPlaceholder('Email'),
    password: page.getByPlaceholder('Password'),
    logIn: page.getByRole('button', { name: 'Log in', exact: true }),
    rememberMe: page.getByLabel('Remember me'),
    signUp: page.getByRole('button', { name: 'Sign up', exact: true }),
    forgotPassword: page.getByRole('button', { name: 'Forgot password?' }),
  };
}

// Fills the Log in form, clicks Log in and returns the server's answer
async function submitLogin(page, email, password) {
  const form = loginForm(page);
  await form.email.fill(email);
  await form.password.fill(password);
  const [response] = await Promise.all([
    page.waitForResponse(res => res.url().endsWith('/api/auth/login') && res.request().method() === 'POST'),
    form.logIn.click(),
  ]);
  return response;
}

// ---------------------------------------------------------------- Sign up

function signUpForm(page) {
  return {
    // step 1
    fullName: page.getByPlaceholder('Full name'),
    email: page.getByPlaceholder('Email'),
    password: page.getByPlaceholder('Password'),
    countryCode: page.getByRole('button', { name: /\+\d+$/ }),
    phone: page.getByPlaceholder('Phone number'),
    next: page.getByRole('button', { name: 'Next', exact: true }),
    logIn: page.getByRole('button', { name: 'Log in', exact: true }),
    // step 2
    companyName: page.getByPlaceholder('Company name*'),
    location: page.getByPlaceholder('Company location*'),
    website: page.getByPlaceholder('Company website'),
    description: page.getByPlaceholder('Company description'),
    timeZone: page.getByRole('button', { name: /UTC[+-]\d/ }),
    back: page.getByRole('button', { name: 'Back', exact: true }),
    createAccount: page.getByRole('button', { name: 'Create Account', exact: true }),
  };
}

// Fills step 1. Pass only the fields to change from VALID_ACCOUNT, e.g. fillAccount(page, { password: 'abc' })
async function fillAccount(page, changes = {}) {
  const account = { ...VALID_ACCOUNT, ...changes };
  const form = signUpForm(page);
  await form.fullName.fill(account.name);
  await form.email.fill(account.email);
  await form.password.fill(account.password);
  await form.phone.fill(account.phone);
}

// Clicks Next and waits until step 2 opens or an error message shows.
// (Both steps are always in the page, the one not in use is hidden, hence the visible filter.)
async function clickNext(page) {
  await signUpForm(page).next.click();
  await signUpForm(page).companyName.or(page.getByRole('heading', { level: 3 }))
    .filter({ visible: true }).first().waitFor();
}

async function expectStep1(page) {
  await expect(signUpForm(page).fullName, 'Step 1 should still show').toBeVisible();
  await expect(signUpForm(page).companyName, 'Step 2 should not open').toBeHidden();
}

async function expectStep2(page) {
  await expect(signUpForm(page).companyName, 'Step 2 should open').toBeVisible();
  await expect(signUpForm(page).fullName, 'Step 1 should be gone').toBeHidden();
}

// Fills step 1 with valid details and opens step 2
async function goToStep2(page, changes = {}) {
  await fillAccount(page, changes);
  await clickNext(page);
  await expectStep2(page);
}

// Opens a dropdown on step 2 by the text it shows, e.g. 'Select industry*', and clicks an option
async function chooseFromDropdown(page, dropdownText, option) {
  await page.getByRole('button', { name: dropdownText }).click();
  await page.getByText(option, { exact: true }).last().click();
  await expect(page.getByRole('button', { name: dropdownText }), `The choice should replace "${dropdownText}"`).toBeHidden();
}

// Types a location, waits for the suggestions and picks the first one that matches, e.g. 'Bengaluru, Karnataka, India'
async function pickLocation(page, text, suggestion) {
  await signUpForm(page).location.fill(text);
  const option = page.getByRole('button', { name: new RegExp(suggestion) }).first();
  await option.click({ timeout: 20000 });
  await expect(option, 'The suggestions should close').toBeHidden();
}

// Fills step 2. Pass only the fields to change from VALID_COMPANY, or null to leave one empty,
// e.g. fillCompany(page, { industry: null })
async function fillCompany(page, changes = {}) {
  const company = { ...VALID_COMPANY, ...changes };
  const form = signUpForm(page);
  if (company.name) await form.companyName.fill(company.name);
  if (company.industry) await chooseFromDropdown(page, 'Select industry*', company.industry);
  if (company.size) await chooseFromDropdown(page, 'Select company size*', company.size);
  if (company.location) await pickLocation(page, company.location, company.location);
  if (company.website) await form.website.fill(company.website);
}

// Clicks Create Account and returns the server's answer
async function submitSignUp(page) {
  const [response] = await Promise.all([
    page.waitForResponse(res => res.url().endsWith('/api/auth/register') && res.request().method() === 'POST'),
    signUpForm(page).createAccount.click(),
  ]);
  return response;
}

module.exports = {
  BASE_URL, UNREGISTERED_EMAIL, VALID_ACCOUNT, VALID_COMPANY, INDUSTRIES, COMPANY_SIZES,
  openLogin, openSignUp, knownDefect, toast, browserCheck, watchRequests, expectNothingSent, showPasswordButton,
  loginForm, submitLogin,
  signUpForm, fillAccount, clickNext, expectStep1, expectStep2, goToStep2,
  chooseFromDropdown, pickLocation, fillCompany, submitSignUp,
};
