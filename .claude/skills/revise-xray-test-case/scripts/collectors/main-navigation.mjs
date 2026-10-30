// TEST-887 collector: the top-level menu links, where each category link leads on desktop, what
// tapping a category does in the mobile menu, and whether the logo returns to the homepage.
// Mobile sub-menus are CMS tiles that differ per site, so only "the menu stays open on the
// homepage and shows more" is recorded for them.
const CATEGORY = {
  women: /^WOMENS?$/i,
  men: /^MENS?$/i,
  kids: /^KIDS$/i,
  sale: /^(SALE|OUTLET|BLACK FRIDAY)$/i,
};

// Only what is on screen counts: off-canvas panels have a size but sit outside the viewport.
const onScreen = (page, selector) =>
  page.evaluate((sel) => {
    const shown = (e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight && getComputedStyle(e).visibility !== 'hidden';
    };
    return [...document.querySelectorAll(sel)].filter(shown).map((e) => ({
      text: (e.innerText || e.getAttribute('alt') || '').replace(/\s+/g, ' ').trim(),
      tag: e.tagName.toLowerCase(),
      href: e.getAttribute('href'),
      inHeader: !!e.closest('header'),
    }));
  }, selector);

const id = (c) => `${c.tag}|${c.text}|${c.href}`;
const describe = (c) => `${c.text}${c.tag === 'button' ? ' [button]' : ''} -> ${c.href}`;
const exact = (text) => new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');

async function load({ page, dismissPopups }, url) {
  await page.goto(url, { waitUntil: 'commit', timeout: 90000 });
  await page.locator('main').first().waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForTimeout(3000);
  await dismissPopups();
}

const path = (page) => new URL(page.url()).pathname;

// A marketing pop-up sometimes covers a control, so close pop-ups and retry.
async function tap({ page, dismissPopups, shot }, locator, label) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await locator.click({ timeout: 10000 });
      return true;
    } catch {
      await shot(`click-failed-${label}-${attempt}`);
      await dismissPopups();
      await page.waitForTimeout(2000);
    }
  }
  return false;
}

export default async function collect(ctx) {
  const { page, site, viewport, shot } = ctx;
  const origin = new URL(site.url).origin;
  const data = { categories: {} };
  await ctx.dismissPopups();

  if (viewport === 'desktop') {
    const nav = (await onScreen(page, 'header a')).filter((c) => c.text);
    data.nav = nav.map(describe);
    for (const [name, re] of Object.entries(CATEGORY)) {
      const link = nav.find((c) => re.test(c.text) && c.href);
      if (!link) {
        data.categories[name] = null;
        continue;
      }
      await load(ctx, new URL(link.href, origin).href);
      data.categories[name] = { label: link.text, href: link.href, landed: path(page) };
    }
  } else {
    const menuButton = page.locator('header [aria-label="Toggle navigation panel"]:visible').first();
    for (const [name, re] of Object.entries(CATEGORY)) {
      await load(ctx, site.url);
      const before = new Set((await onScreen(page, 'a, button')).map(id));
      if (!(await tap(ctx, menuButton, `menu-${name}`))) {
        data.categories[name] = { error: 'menu button could not be tapped' };
        continue;
      }
      await page.waitForTimeout(1500);
      const menu = (await onScreen(page, 'a, button')).filter((c) => c.text && !before.has(id(c)));
      if (!data.nav) {
        data.nav = menu.map(describe);
        await shot('menu-open');
      }
      const item = menu.find((c) => re.test(c.text));
      if (!item) {
        data.categories[name] = null;
        continue;
      }
      const shownBefore = new Set((await onScreen(page, 'a, button, img')).map(id));
      const tapped = await tap(ctx, page.locator(`${item.tag}:visible`, { hasText: exact(item.text) }).first(), name);
      await page.waitForTimeout(2000);
      const appeared = (await onScreen(page, 'a, button, img')).filter((c) => !shownBefore.has(id(c)));
      if (name === 'men') await shot('men-tapped');
      data.categories[name] = {
        label: item.text,
        kind: item.tag,
        tapped,
        pathAfterTap: path(page),
        newlyShown: appeared.length,
        examples: appeared.filter((c) => c.text).slice(0, 4).map(describe),
      };
    }
    // Mobile can't reach a listing page through stable menu links, so start the logo check from one.
    await load(ctx, new URL('/shop/sale', origin).href);
  }

  const logo = page.locator(`header a[href="/"]:visible, header a[href="${origin}/"]:visible`).first();
  data.logo = { found: (await logo.count()) > 0, from: path(page) };
  if (data.logo.found) {
    data.logo.alt = await logo.locator('img').first().getAttribute('alt').catch(() => null);
    await tap(ctx, logo, 'logo');
    await page.waitForTimeout(3000);
    data.logo.landed = path(page);
  }
  return data;
}
