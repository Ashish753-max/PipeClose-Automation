const { test, expect, devices } = require('@playwright/test');
const loginConfig = require('../common/loginConfig');

// Checks the Deals board, Add deal form and Deal details on a phone and a tablet.
// Creates one deal per screen ("Resp<number>") through the Add deal form.
// Screenshots are saved in screenshots/Deal-Responsive/ as proof.
const BASE_URL = 'https://staging.pipeclose.com';
const screens = [
  { name: 'mobile', device: 'iPhone 13' }, // 390x664, touch
  { name: 'tablet', device: 'iPad Mini' }, // 768x1024, touch
];

// Runs in the page: layout problems inside root (whole page by default) at the current screen size
function findLayoutProblems(root) {
  root = root || document.body;
  const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
  const describe = el => (el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.innerText || el.value || '')
    .trim().replace(/\s+/g, ' ').slice(0, 40) || `<${el.tagName.toLowerCase()} icon>`;
  const shown = el => {
    if (el.closest('[aria-hidden="true"],[inert]')) return false;
    const style = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return style.visibility !== 'hidden' && style.display !== 'none' && r.width > 2 && r.height > 2;
  };
  // Inside a box that scrolls sideways (the board columns, a table): fine to reach by scrolling
  const scrollsSideways = el => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (/auto|scroll/.test(getComputedStyle(p).overflowX) && p.scrollWidth > p.clientWidth) return true;
    }
    return false;
  };
  // Not wholly inside the screen and its scrolling boxes (partly scrolled out of view, not covered)
  const partlyScrolledOut = (el, r) => {
    if (r.left < 0 || r.top < 0 || r.right > vw || r.bottom > vh) return true;
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const style = getComputedStyle(p);
      if (style.overflowX === 'visible' && style.overflowY === 'visible') continue;
      const box = p.getBoundingClientRect();
      if (r.left < box.left - 1 || r.top < box.top - 1 || r.right > box.right + 1 || r.bottom > box.bottom + 1) return true;
    }
    return false;
  };

  const controls = [...root.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=tab],[role=combobox]')]
    .filter(shown);
  const cutOff = [], hiddenButFocusable = [], covered = [], small = [];
  for (const el of controls) {
    const r = el.getBoundingClientRect();
    // Entirely off the left edge: the closed sidebar drawer
    if (r.right <= 0) hiddenButFocusable.push(describe(el));
    else if ((r.left < -1 || r.right > vw + 1) && !scrollsSideways(el)) cutOff.push(`${describe(el)} (x ${Math.round(r.left)} to ${Math.round(r.right)})`);
    if (r.width < 24 || r.height < 24) small.push(`${describe(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    // Something else on top of the control's centre means a tap goes to that instead
    if (!partlyScrolledOut(el, r)) {
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (top && !el.contains(top) && !top.contains(el)) covered.push(`${describe(el)} is under "${describe(top)}"`);
    }
  }
  const tinyText = new Set();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim() || !shown(n.parentElement)) continue;
    const size = parseFloat(getComputedStyle(n.parentElement).fontSize);
    if (size < 12) tinyText.add(`${n.textContent.trim().slice(0, 30)} (${size}px)`);
  }
  return {
    pageScroll: document.documentElement.scrollWidth - vw,
    cutOff: [...new Set(cutOff)],
    covered: [...new Set(covered)],
    hiddenButFocusable: hiddenButFocusable.length,
    small: [...new Set(small)],
    tinyText: [...tinyText],
  };
}

// Text cut short with "..." (wider than its box)
const isTruncated = locator => locator.evaluate(el => el.scrollWidth > el.clientWidth + 1);

// Scrolls to the element the way a user can (only boxes that scroll, never ones with overflow hidden,
// which Playwright's own scrolling would move) and returns the share of it that can be seen (0 to 1)
const visibleShare = locator => locator.evaluate(el => {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const style = getComputedStyle(p);
    const r = el.getBoundingClientRect(), box = p.getBoundingClientRect();
    if (/auto|scroll/.test(style.overflowY) && p.scrollHeight > p.clientHeight) p.scrollTop += r.top - box.top - (box.height - r.height) / 2;
    if (/auto|scroll/.test(style.overflowX) && p.scrollWidth > p.clientWidth) p.scrollLeft += r.left - box.left - (box.width - r.width) / 2;
  }
  const r = el.getBoundingClientRect();
  let left = Math.max(r.left, 0), top = Math.max(r.top, 0);
  let right = Math.min(r.right, innerWidth), bottom = Math.min(r.bottom, innerHeight);
  for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
    const style = getComputedStyle(p);
    if (style.overflowX === 'visible' && style.overflowY === 'visible') continue;
    const box = p.getBoundingClientRect();
    left = Math.max(left, box.left); top = Math.max(top, box.top);
    right = Math.min(right, box.right); bottom = Math.min(bottom, box.bottom);
  }
  return Math.max(0, right - left) * Math.max(0, bottom - top) / (r.width * r.height);
});

for (const screen of screens) {
  test.describe(`Deal responsive - ${screen.name}`, () => {
    // Device size, touch and mobile viewport, in Chromium (the device's own browser needs a separate worker)
    const { defaultBrowserType, ...device } = devices[screen.device];
    test.use(device);

    test(`Deals board, Add deal and Deal details - ${screen.name} (${screen.device})`, async ({ page }) => {
      test.setTimeout(300000);
      const prefix = `screenshots/Deal-Responsive/${screen.name}`;
      const shot = step => page.screenshot({ path: `${prefix}-${step}.png` });

      // Bugs fail the test (soft, so every screen is still checked); improvements are only logged
      const checkLayout = async (label, root) => {
        const found = await (root ? root.evaluate(findLayoutProblems) : page.evaluate(findLayoutProblems));
        console.log(`\n[${screen.name}] ${label}: page scrolls sideways by ${found.pageScroll}px`);
        if (found.cutOff.length) console.log('  cut off at the screen edge:', found.cutOff);
        if (found.covered.length) console.log('  covered:', found.covered);
        if (found.hiddenButFocusable) console.log(`  ${found.hiddenButFocusable} off-screen controls still reachable with Tab`);
        if (found.small.length) console.log(`  ${found.small.length} tap targets under 24px:`, found.small.slice(0, 8));
        if (found.tinyText.length) console.log(`  ${found.tinyText.length} texts under 12px:`, found.tinyText.slice(0, 8));
        expect.soft(found.pageScroll, `${label}: page should not scroll sideways`).toBeLessThanOrEqual(0);
        expect.soft(found.cutOff, `${label}: controls should not be cut off at the screen edge`).toEqual([]);
        expect.soft(found.covered, `${label}: controls should not be covered by another element`).toEqual([]);
        return found;
      };

      // Login
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /width=device-width/);
      await page.getByPlaceholder('Email').fill(loginConfig.email);
      await page.getByPlaceholder('Password').fill(loginConfig.password);
      await page.locator("//button[@type='submit']").click();
      await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 30000 });

      // Deals board
      await page.goto(`${BASE_URL}/deals`);
      const dealBtn = page.getByRole('button', { name: 'Deal', exact: true });
      await expect(page.getByText(/^\d+ deals$/).first()).toBeVisible({ timeout: 30000 });
      await page.getByRole('heading', { level: 4 }).first().waitFor({ timeout: 30000 });
      await expect(dealBtn, '+ Deal should be on screen').toBeInViewport();

      // A first visit shows the cookie banner: it must not sit on top of the Add deal form
      const cookieAccept = page.getByRole('button', { name: 'Accept', exact: true });
      if (await cookieAccept.isVisible({ timeout: 5000 }).catch(() => false)) {
        await dealBtn.click();
        const form = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Add deal' }) });
        await expect(form).toBeVisible();
        await shot('01-add-deal-with-cookie-banner');
        for (const name of ['Save', 'Cancel']) {
          const button = form.getByRole('button', { name, exact: true });
          const onTop = await button.evaluate(el => {
            const r = el.getBoundingClientRect();
            const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return !top || el.contains(top);
          });
          expect.soft(onTop, `Cookie banner should not cover the Add deal ${name} button`).toBe(true);
        }
        await cookieAccept.click();
        await form.getByRole('button', { name: 'Cancel', exact: true }).click();
        await expect(form).toBeHidden();
      }
      await checkLayout('Deals board');
      await shot('02-board');

      // Navigation: phones open it from the menu button, tablets show the sidebar (icon links, no names)
      const dealsNav = page.getByRole('navigation').locator('a[href="/deals"]');
      if (!(await dealsNav.evaluate(el => el.getBoundingClientRect().right > 0))) {
        await page.getByRole('banner').getByRole('button').first().click();
        await expect(dealsNav, 'Menu button should open the navigation').toBeInViewport();
        await shot('03-menu-open');
        await page.mouse.click(page.viewportSize().width - 40, 400); // tap the dimmed page beside the menu
        await expect.soft(dealsNav, 'Tapping outside should close the menu').not.toBeInViewport();
      } else {
        await expect(dealsNav).toBeInViewport();
      }

      // List view: page must not scroll, count the columns that fit
      await page.getByRole('button', { name: 'List View' }).click();
      await expect(page.getByRole('columnheader', { name: 'TITLE' })).toBeVisible({ timeout: 30000 });
      await page.getByRole('row').nth(1).waitFor();
      await checkLayout('Deals list view');
      const headers = page.getByRole('columnheader');
      const shownColumns = [];
      for (let i = 0; i < await headers.count(); i++) {
        const header = headers.nth(i);
        const text = (await header.innerText()).trim();
        if (text && await header.evaluate(el => {
          const r = el.getBoundingClientRect();
          return r.left >= 0 && r.right <= document.documentElement.clientWidth;
        })) shownColumns.push(text);
      }
      console.log(`[${screen.name}] list view shows ${shownColumns.length} of ${await headers.count() - 1} columns without scrolling:`, shownColumns);
      await shot('04-list-view');
      await page.getByRole('button', { name: 'Pipeline View' }).click();
      await page.getByRole('heading', { level: 4 }).first().waitFor();

      // Add deal form
      const stamp = Date.now().toString().slice(-6);
      const person = `Resp${stamp}`;
      await dealBtn.click();
      const form = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Add deal' }) });
      await expect(form).toBeVisible();
      await checkLayout('Add deal form', form);
      for (const name of ['Save', 'Cancel']) {
        await expect.soft(form.getByRole('button', { name, exact: true }), `${name} should be on screen`).toBeInViewport();
      }
      // The white form panel: fits the width, and the floating assistant button stays behind it
      const panel = form.getByRole('heading', { name: 'Add deal' }).locator('xpath=ancestor::div[.//button[normalize-space()="Save"]][1]');
      const panelBox = await panel.boundingBox();
      expect.soft(panelBox.x >= 0 && panelBox.x + panelBox.width <= page.viewportSize().width, 'Add deal form should fit the screen width').toBe(true);
      const assistant = page.getByRole('button', { name: 'PipeClose', exact: true });
      if (await assistant.isVisible()) {
        const a = await assistant.boundingBox();
        const overlaps = a.x < panelBox.x + panelBox.width && a.x + a.width > panelBox.x
          && a.y < panelBox.y + panelBox.height && a.y + a.height > panelBox.y;
        const onTop = await assistant.evaluate(el => {
          const r = el.getBoundingClientRect();
          return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
        });
        expect.soft(overlaps && onTop, 'Floating assistant button should not sit on top of the Add deal form').toBe(false);
      }

      await form.getByRole('textbox', { name: 'Name' }).first().fill(person);
      const orgField = form.getByRole('textbox', { name: 'Name' }).nth(1);
      await orgField.click();
      await orgField.pressSequentially(`RespOrg${stamp}`);
      await page.waitForTimeout(1000);
      await orgField.press('ArrowDown');
      await orgField.press('Enter');
      const titleField = form.getByRole('textbox', { name: 'Deal title' });
      await expect(titleField, 'Deal title should auto-fill').not.toHaveValue('');
      const dealTitle = await titleField.inputValue();
      await form.getByPlaceholder('0').fill('3000');
      // Suggestion lists open on top of the fields below them, so they must close once a field is done
      for (const name of [person, `RespOrg${stamp}`]) {
        await expect.soft(form.getByText(`Add "${name}" as new`), `"Add ${name} as new" suggestion should close after moving on`).toBeHidden();
      }
      await shot('05-add-deal-top');
      const phone = form.getByPlaceholder('Phone number');
      await phone.scrollIntoViewIfNeeded();
      await phone.fill('9876543210');
      await form.getByPlaceholder('Email address').fill(`deal.responsive+${Date.now()}@gmail.com`);
      await expect(phone, 'Phone field should be on screen while typing').toBeInViewport();
      await shot('06-add-deal-contact');

      // (No success message is checked: saving shows none at any screen size, desktop included)
      const [created] = await Promise.all([
        page.waitForResponse(r => r.url().includes('/api/deals/create') && r.request().method() === 'POST'),
        form.getByRole('button', { name: 'Save', exact: true }).click(),
      ]);
      expect(created.ok(), `Create deal API returned ${created.status()}`).toBeTruthy();
      await expect(form, 'Form should close after save').toBeHidden();
      const card = page.getByRole('heading', { name: dealTitle, level: 4 }).first();
      await expect(card, 'New deal should be on the board').toBeVisible();
      await shot('07-board-after-save');
      console.log(`[${screen.name}] created "${dealTitle}"`);

      // Deal details
      await card.click();
      await expect(page).toHaveURL(/\/deals\/\d+/);
      await expect(page.getByText('First name', { exact: true })).toBeAttached({ timeout: 30000 });
      await page.waitForTimeout(3000); // AI analysis re-renders the page when a deal is first opened
      await checkLayout('Deal details');
      await shot('08-details');

      const title = page.getByRole('heading', { name: dealTitle, level: 1 });
      await expect.soft(title, 'Deal name should be visible').toBeVisible();
      if (await title.isVisible()) expect.soft(await isTruncated(title), 'Deal name should not be cut short').toBe(false);
      const lost = page.getByRole('button', { name: 'Lost', exact: true });
      await expect.soft(page.getByRole('button', { name: 'Won', exact: true }), 'Won should be on screen').toBeInViewport();
      await expect.soft(lost, 'Lost should be on screen').toBeInViewport();
      await expect.soft(lost.locator('xpath=following::button[1]'), 'More actions (...) should be on screen').toBeInViewport();

      // Left panel: person fields
      const firstName = page.getByText('First name', { exact: true });
      expect.soft(await visibleShare(firstName), 'Person fields should be reachable').toBeGreaterThan(0.95);
      await shot('09-details-person');

      // Right panel: tabs, email composer and history must be reachable
      const main = page.getByRole('main');
      const reachable = async (locator, what) => {
        const share = await visibleShare(locator);
        console.log(`[${screen.name}] ${what}: ${Math.round(share * 100)}% can be seen`);
        expect.soft(share, `${what} should be fully reachable`).toBeGreaterThan(0.95);
      };
      for (const tab of ['Email', 'Activity', 'Notes', 'Call', 'Files']) {
        await reachable(main.getByRole('button', { name: tab, exact: true }), `${tab} tab`);
      }
      await reachable(main.getByRole('combobox').filter({ hasText: '@' }).first(), 'Email From field');
      await reachable(main.getByRole('button', { name: 'Send Now' }), 'Send Now');
      await shot('10-details-email');
      await reachable(main.getByRole('button', { name: /^Drafts \(\d+\)$/ }), 'History "Drafts" filter');
      await shot('11-details-history');
    });
  });
}
