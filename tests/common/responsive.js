// tests/common/responsive.js
// Layout checks shared by the responsive tests (phone and tablet screens)

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
      // A sticky column over a box that scrolls sideways: scrolling brings the control out from under it
      const underStickyColumn = () => {
        for (let p = top; p; p = p.parentElement) if (getComputedStyle(p).position === 'sticky') return scrollsSideways(el);
        return false;
      };
      if (top && !el.contains(top) && !top.contains(el) && !underStickyColumn()) covered.push(`${describe(el)} is under "${describe(top)}"`);
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

// Taps on a grid of points across the element and returns the share that reach it (0 to 1):
// below 1 means something (a sticky column, a floating button) covers part of it
const tapShare = locator => locator.evaluate(input => {
  // A visually hidden input (custom checkbox) is tapped through the label that draws it
  const el = input.getBoundingClientRect().width <= 2 && (input.closest('label') || input.labels?.[0]) || input;
  const r = el.getBoundingClientRect();
  let hits = 0, total = 0;
  for (const fx of [0.1, 0.3, 0.5, 0.7, 0.9]) {
    for (const fy of [0.3, 0.5, 0.7]) {
      total++;
      const top = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy);
      if (top && el.contains(top)) hits++;
    }
  }
  return hits / total;
});

module.exports = { findLayoutProblems, isTruncated, visibleShare, tapShare };
