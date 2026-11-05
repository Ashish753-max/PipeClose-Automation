const { test, expect } = require('@playwright/test');
const loginConfig = require('../common/loginConfig');
const {
  VALID_ACCOUNT, INDUSTRIES, COMPANY_SIZES, openSignUp, knownDefect, toast, expectNothingSent, showPasswordButton,
  signUpForm, fillAccount, clickNext, expectStep1, expectStep2, goToStep2, chooseFromDropdown, pickLocation,
  fillCompany, submitSignUp,
} = require('../common/authPages');

// Sign up page (/register): what is accepted, what is refused and what the user is told.
// Step 1 (your details) is checked in the page when Next is clicked, and nothing is sent.
//   Checked today: the password rule and a complete phone number (Full name and Email are not checked here).
// Step 2 (company details) is checked in the page when Create Account is clicked:
//   Company name, Industry, Company size and Location are required, Website must look like a website.
// Then the server checks everything again (400 naming the field) and refuses an email that has an account (409).
// Errors show in a message box at the top right, e.g. "Invalid Password".
//
// No test makes an account: Create Account is only sent with the test account's email (refused with
// "User already exists") or with details the server refuses. A safety net in openSignUp stops anything else.
// Tests calling knownDefect() check a defect found on staging: see knownDefect in tests/common/authPages.js.

test.beforeEach(async ({ page }) => {
  await openSignUp(page);
});

// Next is clicked, step 1 stays and the message box shows this title and text
async function expectStep1Error(page, title, message) {
  await expectNothingSent(page, '/api/auth/register', () => clickNext(page));
  await expect(toast(page, title), `"${title}" should show`).toContainText(message);
  await expectStep1(page);
}

// Create Account is clicked, nothing is sent and the message box shows this title and text
async function expectStep2Error(page, title, message) {
  await expectNothingSent(page, '/api/auth/register', () => signUpForm(page).createAccount.click());
  await expect(toast(page, title), `"${title}" should show`).toContainText(message);
  await expect(signUpForm(page).companyName, 'Step 2 should stay open').toBeVisible();
}

// The server refused the sign up with this status and the "Registration Error" message shows this text
async function expectServerRefused(page, response, status, message) {
  expect(response.status(), `The server should refuse with ${status}`).toBe(status);
  await expect(toast(page, 'Registration Error'), 'A "Registration Error" message should show').toContainText(message);
  await expect(page, 'The user should stay on Sign up').toHaveURL(/\/register/);
}

const PASSWORD_RULE = 'Must be at least 8 characters, including uppercase, lowercase, number, and special character';
const PHONE_RULE = 'Please enter a complete phone number for the selected country';
const WEBSITE_RULE = 'Please enter a valid website';

// ================================================================ Step 1

test.describe('Sign up step 1 - accepted', () => {
  test('valid details open step 2 without sending anything', async ({ page }) => {
    await fillAccount(page);
    await expectNothingSent(page, '/api/auth/register', () => clickNext(page));
    await expectStep2(page);
  });

  test('a password of exactly 8 characters that meets the rule is accepted', async ({ page }) => {
    await goToStep2(page, { password: 'Te@12345' });
  });

  test('Back on step 2 returns to step 1 with every detail kept', async ({ page }) => {
    await goToStep2(page);
    const form = signUpForm(page);
    await form.companyName.fill('Kept Company');
    await form.back.click();
    await expect(form.fullName).toHaveValue(VALID_ACCOUNT.name);
    await expect(form.email).toHaveValue(VALID_ACCOUNT.email);
    await expect(form.password).toHaveValue(VALID_ACCOUNT.password);
    await expect(form.phone).toHaveValue('(201) 555-0123');
    await clickNext(page);
    await expect(form.companyName, 'The company name should be kept too').toHaveValue('Kept Company');
  });

  test('the phone number is formatted while typing and letters are ignored', async ({ page }) => {
    const phone = signUpForm(page).phone;
    await phone.pressSequentially('abc');
    await expect(phone, 'Letters should not be typed').toHaveValue('');
    await phone.pressSequentially('2015550123');
    await expect(phone).toHaveValue('(201) 555-0123');
  });

  test('typing more digits than a phone number has stops at a full number', async ({ page }) => {
    const phone = signUpForm(page).phone;
    await phone.pressSequentially('20155501239999');
    await expect(phone).toHaveValue('(201) 555-0123');
  });

  test('another country can be chosen for the phone number', async ({ page }) => {
    const form = signUpForm(page);
    await expect(form.countryCode, 'The country should start as +1').toHaveText(/\+1$/);
    await form.countryCode.click();
    await page.getByPlaceholder('Search country or dial code…').fill('India');
    await page.getByRole('button', { name: /India \+91$/ }).click();
    await expect(form.countryCode).toHaveText(/\+91$/);
    await fillAccount(page, { phone: '9876543210' });
    await expect(form.phone).toHaveValue('98765 43210');
    await clickNext(page);
    await expectStep2(page);
  });

  test('the password is hidden until the eye button is clicked', async ({ page }) => {
    const password = signUpForm(page).password;
    await password.fill(VALID_ACCOUNT.password);
    await expect(password).toHaveAttribute('type', 'password');
    await showPasswordButton(page).click();
    await expect(password, 'The password should show').toHaveAttribute('type', 'text');
    await showPasswordButton(page).click();
    await expect(password, 'The password should be hidden again').toHaveAttribute('type', 'password');
  });

  test('Log in opens the Log in page', async ({ page }) => {
    await signUpForm(page).logIn.click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });
});

test.describe('Sign up step 1 - stopped (nothing is sent)', () => {
  test('all boxes empty', async ({ page }) => {
    await expectNothingSent(page, '/api/auth/register', () => clickNext(page));
    await expect(page.getByRole('heading', { level: 3 }).first(), 'An error message should show').toBeVisible();
    await expectStep1(page);
  });

  const badPasswords = [
    ['empty', ''],
    ['of 7 characters', 'Te@1234'],
    ['without an uppercase letter', 'test@1234'],
    ['without a number', 'Test@abcd'],
    ['without a special character', 'Test12345'],
    ['of only spaces', '          '],
  ];
  for (const [label, password] of badPasswords) {
    test(`password ${label}`, async ({ page }) => {
      await fillAccount(page, { password });
      await expectStep1Error(page, 'Invalid Password', PASSWORD_RULE);
    });
  }

  const badPhones = [
    ['empty', ''],
    ['too short', '123'],
    ['missing its last digit', '201555012'],
  ];
  for (const [label, phone] of badPhones) {
    test(`phone number ${label}`, async ({ page }) => {
      await fillAccount(page, { phone });
      await expectStep1Error(page, 'Incomplete Phone Number', PHONE_RULE);
    });
  }
});

test.describe('Sign up step 1 - known defects', () => {
  // Each of these goes on to step 2. The server refuses most of them only after step 2 is filled in,
  // with a technical message such as "userData.email: Invalid email address".
  const notChecked = [
    ['empty Full name', { name: '' }],
    ['Full name shorter than 3 characters', { name: 'AB' }],
    ['Full name of only spaces', { name: '   ' }],
    ['empty Email', { email: '' }],
    ['Email without @', { email: 'qa.example.com' }],
    ['Email with two @', { email: 'qa@@example.com' }],
  ];
  for (const [label, changes] of notChecked) {
    test(`${label} is stopped at step 1`, async ({ page }) => {
      knownDefect(`Step 1 does not check this: ${label} goes on to step 2`);
      await fillAccount(page, changes);
      await clickNext(page);
      await expectStep1(page);
    });
  }

  test('the password message matches the rule that is applied', async ({ page }) => {
    knownDefect('"Invalid Password" asks for a lowercase letter, but a password without one (TEST@1234) is accepted');
    const form = signUpForm(page);
    await fillAccount(page, { password: 'test@1234' });
    await clickNext(page);
    const message = toast(page, 'Invalid Password');
    const asksForLowercase = /lowercase/i.test(await message.innerText());
    await message.getByRole('button').click(); // close it
    await expect(message).toBeHidden();

    await form.password.fill('TEST@1234');
    await clickNext(page);
    const acceptedWithoutLowercase = await form.companyName.isVisible();
    expect(asksForLowercase && acceptedWithoutLowercase,
      'The message asks for a lowercase letter, so a password without one should be stopped').toBe(false);
  });
});

// ================================================================ Step 2

test.describe('Sign up step 2 - company details', () => {
  test.beforeEach(async ({ page }) => {
    await goToStep2(page);
  });

  test('the Industry list shows every industry and the choice is kept', async ({ page }) => {
    await page.getByRole('button', { name: 'Select industry*' }).click();
    for (const industry of INDUSTRIES) {
      await expect(page.getByText(industry, { exact: true }).last(), `${industry} should be listed`).toBeVisible();
    }
    await page.getByText('Healthcare', { exact: true }).last().click();
    await expect(page.getByRole('button', { name: 'Healthcare' })).toBeVisible();
  });

  test('the Company size list shows every size and the choice is kept', async ({ page }) => {
    await page.getByRole('button', { name: 'Select company size*' }).click();
    for (const size of COMPANY_SIZES) {
      await expect(page.getByText(size, { exact: true }).last(), `${size} should be listed`).toBeVisible();
    }
    await page.getByText('51 – 200', { exact: true }).last().click();
    await expect(page.getByRole('button', { name: /51 – 200/ })).toBeVisible();
  });

  test('picking a suggested location fills it in and sets its time zone', async ({ page }) => {
    const form = signUpForm(page);
    await pickLocation(page, 'Tokyo', 'Tokyo, Japan');
    await expect(form.location).toHaveValue(/^Tokyo, Japan/);
    await expect(form.timeZone, 'The time zone should follow the location').toContainText('UTC+09:00');
  });

  test('Company name empty', async ({ page }) => {
    await fillCompany(page, { name: null });
    await expectStep2Error(page, 'Company Name Required', 'Please enter your company name');
  });

  test('Company name of only spaces', async ({ page }) => {
    await fillCompany(page, { name: '    ' });
    await expectStep2Error(page, 'Company Name Required', 'Please enter your company name');
  });

  test('no Industry chosen', async ({ page }) => {
    await fillCompany(page, { industry: null });
    await expectStep2Error(page, 'Industry Required', 'Please select your company industry');
  });

  test('no Company size chosen', async ({ page }) => {
    await fillCompany(page, { size: null });
    await expectStep2Error(page, 'Company Size Required', 'Please select your company size');
  });

  test('Company location empty', async ({ page }) => {
    await fillCompany(page, { location: null });
    await expectStep2Error(page, 'Company Location Required', 'Please enter your company location');
  });

  const badWebsites = ['example', 'http://', 'ftp://example.com', 'exa mple.com', 'javascript:alert(1)'];
  for (const website of badWebsites) {
    test(`Website "${website}" is not a website`, async ({ page }) => {
      await fillCompany(page, { website });
      await expectStep2Error(page, 'Invalid Website', WEBSITE_RULE);
    });
  }
});

// ================================================================ Create Account (checked by the server)

test.describe('Sign up - Create Account', () => {
  test('valid details are refused only because the email already has an account', async ({ page }) => {
    await goToStep2(page);
    await fillCompany(page);
    const response = await submitSignUp(page);
    // "User already exists" comes only after every field has passed the server's checks
    await expectServerRefused(page, response, 409, 'User already exists');

    const { userData, companyData } = response.request().postDataJSON();
    expect(userData).toMatchObject({ name: VALID_ACCOUNT.name, email: VALID_ACCOUNT.email, phone: '+12015550123', phoneCountryCode: 'US' });
    expect(companyData).toMatchObject({ name: 'QA Automation Co', industries: 'Technology / SaaS', companySize: '1-10' });
    expect(companyData.companyLocation).toMatch(/^Bengaluru/);
  });

  // A website typed without http:// or https:// is sent with https:// in front
  const goodWebsites = [
    ['example.com', 'https://example.com'],
    ['https://example.com/', 'https://example.com/'],
    ['www.example.co.in', 'https://www.example.co.in'],
    ['app.vercel.com', 'https://app.vercel.com'],
  ];
  for (const [website, sent] of goodWebsites) {
    test(`Website "${website}" is accepted`, async ({ page }) => {
      await goToStep2(page);
      await fillCompany(page, { website });
      const response = await submitSignUp(page);
      await expectServerRefused(page, response, 409, 'User already exists');
      expect(response.request().postDataJSON().companyData.companyWebsite, 'Website as sent').toBe(sent);
    });
  }

  test('the email is matched to the existing account whatever its capital letters', async ({ page }) => {
    await goToStep2(page, { email: loginConfig.email.toUpperCase() });
    await fillCompany(page);
    await expectServerRefused(page, await submitSignUp(page), 409, 'User already exists');
  });

  test('a Full name shorter than 3 characters is refused', async ({ page }) => {
    await goToStep2(page, { name: 'AB' });
    await fillCompany(page);
    await expectServerRefused(page, await submitSignUp(page), 400, 'Name must be at least 3 characters');
  });

  test('an invalid email is refused', async ({ page }) => {
    await goToStep2(page, { email: 'qa@@example.com' });
    await fillCompany(page);
    await expectServerRefused(page, await submitSignUp(page), 400, 'Invalid email address');
  });

  test('a Full name of only spaces is refused', async ({ page }) => {
    knownDefect('A Full name of only spaces passes the server\'s check (it counts the spaces as 3 characters)');
    await goToStep2(page, { name: '   ' });
    await fillCompany(page);
    await expectServerRefused(page, await submitSignUp(page), 400, 'Name');
  });

  test('server error messages are written for the user', async ({ page }) => {
    knownDefect('Server errors show the internal field path, e.g. "userData.email: Invalid email address"');
    await goToStep2(page, { email: 'qa@@example.com' });
    await fillCompany(page);
    await submitSignUp(page);
    const message = toast(page, 'Registration Error');
    await expect(message).toBeVisible();
    await expect(message).not.toContainText('userData.');
  });

  test('double-clicking Create Account sends one request', async ({ page }) => {
    knownDefect('Create Account is not disabled while it is sending, so a double click sends two sign ups ' +
      '(on staging one of them failed with a raw database error, HTTP 500)');
    await goToStep2(page);
    await fillCompany(page);
    // The server is not called: each request is answered here after 1 s
    let requests = 0;
    await page.route('**/api/auth/register', async route => {
      requests++;
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.fulfill({ status: 409, json: { success: false, message: 'User already exists' } });
    });
    await signUpForm(page).createAccount.dblclick();
    await expect(toast(page, 'Registration Error').first()).toBeVisible();
    expect(requests, 'One click\'s worth of requests').toBe(1);
  });

  test('a new email makes the account', async ({ page }) => {
    test.skip(!process.env.CREATE_TEST_ACCOUNT, 'Makes a real account on staging: run with CREATE_TEST_ACCOUNT=1');
    const stamp = Date.now();
    await goToStep2(page, { email: `qa.signup.${stamp}@signup-test-${stamp}.example.com` });
    await fillCompany(page, { name: `QA Signup ${stamp}` });
    const response = await submitSignUp(page);
    expect(response.status(), 'The account should be made').toBe(201);
    expect((await response.json()).message).toBe('User Registered Successfully');
    await expect(page, 'The user should leave Sign up').not.toHaveURL(/\/register/, { timeout: 30000 });
  });
});
