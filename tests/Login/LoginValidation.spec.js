const { test, expect } = require('@playwright/test');
const loginConfig = require('../common/loginConfig');
const {
  BASE_URL, UNREGISTERED_EMAIL, openLogin, knownDefect, toast, browserCheck, expectNothingSent, showPasswordButton,
  loginForm, submitLogin,
} = require('../common/authPages');

// Log in page (/login): what is accepted, what is refused and what the user is told.
// The details are checked in three places, in this order:
//   1. the browser: Email and Password must be filled in and Email must look like name@domain (nothing is sent)
//   2. the server's format check (400): email format, and the password rule
//      (8+ characters with an uppercase letter, a number and a special character)
//   3. the server's account check (401 "Invalid email or password")
// Server errors show in a "Login Failed" message box at the top right.
//
// Tests calling knownDefect() check a defect found on staging: see knownDefect in tests/common/authPages.js.

test.beforeEach(async ({ page }) => {
  await openLogin(page);
});

async function expectLoggedIn(page, response) {
  expect(response.status(), 'The server should accept the log in').toBe(200);
  await expect(page, 'Log in should open the Deals page').toHaveURL(/\/deals/, { timeout: 30000 });
}

// The "Login Failed" message shows (with this text, when given) and the user stays on Log in
async function expectLoginFailed(page, message) {
  const box = toast(page, 'Login Failed');
  if (message) await expect(box, `"Login Failed: ${message}" should show`).toContainText(message);
  else await expect(box, 'A "Login Failed" message should show').toBeVisible();
  await expect(page, 'The user should stay on Log in').toHaveURL(/\/login/);
}

test.describe('Log in - accepted', () => {
  test('the correct email and password open the Deals page', async ({ page }) => {
    const response = await submitLogin(page, loginConfig.email, loginConfig.password);
    await expectLoggedIn(page, response);
  });

  test('the email is not case sensitive', async ({ page }) => {
    const response = await submitLogin(page, loginConfig.email.toUpperCase(), loginConfig.password);
    await expectLoggedIn(page, response);
  });

  test('spaces before and after the email are removed', async ({ page }) => {
    const response = await submitLogin(page, `   ${loginConfig.email}   `, loginConfig.password);
    expect(response.request().postDataJSON().email, 'The email should be sent without the spaces').toBe(loginConfig.email);
    await expectLoggedIn(page, response);
  });

  test('Remember me is sent with the log in', async ({ page }) => {
    const form = loginForm(page);
    await expect(form.rememberMe, 'Remember me should start unticked').not.toBeChecked();
    await form.rememberMe.check();
    const response = await submitLogin(page, loginConfig.email, loginConfig.password);
    expect(response.request().postDataJSON().rememberMe, 'rememberMe should be sent as true').toBe(true);
    await expectLoggedIn(page, response);
  });

  test('pressing Enter in the Password box logs in', async ({ page }) => {
    const form = loginForm(page);
    await form.email.fill(loginConfig.email);
    await form.password.fill(loginConfig.password);
    const [response] = await Promise.all([
      page.waitForResponse(res => res.url().endsWith('/api/auth/login')),
      form.password.press('Enter'),
    ]);
    await expectLoggedIn(page, response);
  });
});

test.describe('Log in - stopped by the browser (nothing is sent)', () => {
  test('Email and Password both empty', async ({ page }) => {
    const form = loginForm(page);
    await expectNothingSent(page, '/api/auth/login', () => form.logIn.click());
    expect((await browserCheck(form.email)).empty, 'Email should be flagged as empty').toBe(true);
    expect((await browserCheck(form.password)).empty, 'Password should be flagged as empty').toBe(true);
    await expect(form.email, 'The cursor should go to the first box to fix').toBeFocused();
    await expect(page).toHaveURL(/\/login/);
  });

  test('Email empty', async ({ page }) => {
    const form = loginForm(page);
    await form.password.fill(loginConfig.password);
    await expectNothingSent(page, '/api/auth/login', () => form.logIn.click());
    const check = await browserCheck(form.email);
    expect(check.empty, 'Email should be flagged as empty').toBe(true);
    expect(check.message, 'The browser should say what is wrong').not.toBe('');
    await expect(form.email).toBeFocused();
  });

  test('Password empty', async ({ page }) => {
    const form = loginForm(page);
    await form.email.fill(loginConfig.email);
    await expectNothingSent(page, '/api/auth/login', () => form.logIn.click());
    expect((await browserCheck(form.password)).empty, 'Password should be flagged as empty').toBe(true);
    await expect(form.password).toBeFocused();
  });

  test('Email of only spaces counts as empty', async ({ page }) => {
    const form = loginForm(page);
    await form.email.fill('     ');
    await form.password.fill(loginConfig.password);
    await expectNothingSent(page, '/api/auth/login', () => form.logIn.click());
    expect((await browserCheck(form.email)).empty, 'Email should be flagged as empty').toBe(true);
  });

  const notEmails = [
    ['without @', 'ashishappnox1gmail.com'],
    ['with nothing after @', 'ashishappnox1@'],
    ['with nothing before @', '@gmail.com'],
    ['with two @', 'ashish@@gmail.com'],
    ['with a space inside', 'ashish appnox1@gmail.com'],
    ['with HTML in it', '<script>alert(1)</script>@x.com'],
  ];
  for (const [label, email] of notEmails) {
    test(`Email ${label}: "${email}"`, async ({ page }) => {
      const form = loginForm(page);
      await form.email.fill(email);
      await form.password.fill(loginConfig.password);
      await expectNothingSent(page, '/api/auth/login', () => form.logIn.click());
      const check = await browserCheck(form.email);
      expect(check.notAnEmail, 'Email should be flagged as not an email').toBe(true);
      expect(check.message, 'The browser should say what is wrong').not.toBe('');
      await expect(form.email).toBeFocused();
    });
  }
});

test.describe('Log in - refused by the server', () => {
  test('email without a dot after @ ("ashish@gmail")', async ({ page }) => {
    // The browser lets this through, the server's format check does not
    const response = await submitLogin(page, 'ashish@gmail', loginConfig.password);
    expect(response.status()).toBe(400);
    await expectLoginFailed(page, 'Invalid email address');
  });

  test('wrong password', async ({ page }) => {
    const response = await submitLogin(page, loginConfig.email, 'Wrong@1234');
    expect(response.status()).toBe(401);
    await expectLoginFailed(page, 'Invalid email or password');
  });

  test('email with no account gets the same message as a wrong password', async ({ page }) => {
    // The same message for both, so the page does not reveal which emails have an account
    const response = await submitLogin(page, UNREGISTERED_EMAIL, loginConfig.password);
    expect(response.status()).toBe(401);
    await expectLoginFailed(page, 'Invalid email or password');
  });

  test('the password is case sensitive', async ({ page }) => {
    const response = await submitLogin(page, loginConfig.email, loginConfig.password.toLowerCase());
    // Without its uppercase letter the password fails the password rule (400) before the account check (401)
    expect([400, 401], 'The server should refuse the log in').toContain(response.status());
    await expectLoginFailed(page);
  });

  test('a space at the end of the password is not removed', async ({ page }) => {
    const response = await submitLogin(page, loginConfig.email, `${loginConfig.password} `);
    expect(response.request().postDataJSON().password, 'The password should be sent as typed').toBe(`${loginConfig.password} `);
    expect(response.status()).toBe(401);
    await expectLoginFailed(page, 'Invalid email or password');
  });

  test('password too short for the password rule', async ({ page }) => {
    const response = await submitLogin(page, UNREGISTERED_EMAIL, 'Ab@1');
    expect(response.status()).toBe(400);
    await expectLoginFailed(page, 'Password must contain a minimum of 8 characters');
  });

  test('SQL injection text does not log in', async ({ page }) => {
    const response = await submitLogin(page, "admin'--@example.com", "' OR '1'='1");
    expect([400, 401], 'The server should refuse the log in').toContain(response.status());
    await expectLoginFailed(page);
  });

  test('very long email and password are refused without a server error', async ({ page }) => {
    const response = await submitLogin(page, `${'a'.repeat(250)}@example.com`, `Aa1@${'x'.repeat(300)}`);
    expect([400, 401], 'The server should refuse the log in, not fail (5xx)').toContain(response.status());
    await expectLoginFailed(page);
    await expect(loginForm(page).logIn, 'The form should still work').toBeEnabled();
  });
});

test.describe('Log in page', () => {
  test('the password is hidden until the eye button is clicked', async ({ page }) => {
    const form = loginForm(page);
    await form.password.fill(loginConfig.password);
    await expect(form.password).toHaveAttribute('type', 'password');
    await showPasswordButton(page).click();
    await expect(form.password, 'The password should show').toHaveAttribute('type', 'text');
    await expect(form.password).toHaveValue(loginConfig.password);
    await showPasswordButton(page).click();
    await expect(form.password, 'The password should be hidden again').toHaveAttribute('type', 'password');
  });

  test('Tab moves through the form in order', async ({ page }) => {
    const form = loginForm(page);
    await form.email.focus();
    await page.keyboard.press('Tab');
    await expect(form.password).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(showPasswordButton(page)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(form.logIn).toBeFocused();
  });

  test('the boxes help password managers fill them in', async ({ page }) => {
    const form = loginForm(page);
    await expect(form.email).toHaveAttribute('type', 'email');
    await expect(form.email).toHaveAttribute('autocomplete', 'username');
    await expect(form.password).toHaveAttribute('autocomplete', 'current-password');
  });

  test('the eye button has a name for screen readers', async ({ page }) => {
    knownDefect('The show/hide password button has no aria-label, so a screen reader only says "button"');
    await expect(showPasswordButton(page)).toHaveAccessibleName(/password/i);
  });

  test('Sign up opens the Create account page', async ({ page }) => {
    await loginForm(page).signUp.click();
    await expect(page).toHaveURL(/\/register/);
    await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
  });

  test('Forgot password? opens the reset form and Back to Login returns', async ({ page }) => {
    await loginForm(page).forgotPassword.click();
    await expect(page.getByText('Enter your email to receive an OTP')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send OTP' })).toBeVisible();
    await page.getByRole('button', { name: 'Back to Login' }).click();
    await expect(loginForm(page).logIn).toBeVisible();
  });

  test('Back to website opens the website', async ({ page }) => {
    await page.getByRole('link', { name: 'Back to website' }).click();
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(new RegExp(`^${BASE_URL}/`));
  });

  test('a logged-in user opening Log in or Sign up is taken to Deals', async ({ page }) => {
    await expectLoggedIn(page, await submitLogin(page, loginConfig.email, loginConfig.password));
    await page.goto(`${BASE_URL}/login`);
    await expect(page).toHaveURL(/\/deals/, { timeout: 30000 });
    await page.goto(`${BASE_URL}/register`);
    await expect(page).toHaveURL(/\/deals/, { timeout: 30000 });
  });

  test('Deals cannot be opened without logging in', async ({ page }) => {
    await page.goto(`${BASE_URL}/deals`);
    await expect(page, 'The user should be sent away from Deals').not.toHaveURL(/\/deals/, { timeout: 30000 });
  });

  test('double-clicking Log in sends one request', async ({ page }) => {
    knownDefect('Log in is not disabled while logging in, so a double click sends two requests');
    // The server is not called: each request is answered here after 1 s
    let requests = 0;
    await page.route('**/api/auth/login', async route => {
      requests++;
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.fulfill({ status: 401, json: { success: false, message: 'Invalid email or password' } });
    });
    const form = loginForm(page);
    await form.email.fill(UNREGISTERED_EMAIL);
    await form.password.fill(loginConfig.password);
    await form.logIn.dblclick();
    await expect(toast(page, 'Login Failed').first()).toBeVisible();
    expect(requests, 'One click\'s worth of requests').toBe(1);
  });
});
