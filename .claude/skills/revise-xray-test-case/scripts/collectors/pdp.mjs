// TEST-882 collector: opens the men's listing, walks the product cards until a shoe has colours,
// sizes in stock and a visible Add to Cart, then records what the PDP shows and does: name, price,
// Afterpay line, gallery, colour swatches, Add to Cart without and with a size, the cart badge, the
// size system list (US MENS, UK, EU...) and where a colour swatch leads. Stock changes between runs,
// so compare behaviour and labels across runs, not product names or prices.
const MEN_LISTING = { platypus: '/shop/mens', vans: '/shop/mens', skechers: '/shop/men', drmartens: '/shop/men' };
const MAX_PRODUCTS = 10;
const SIZE_SRC = '^(US\\s+|UK\\s+|EU\\s+)?\\d+(\\.\\d+)?$';
const GENDER_SRC = '\\b(mens?|womens?|us\\s+mens?|us\\s+womens?|uk\\s+mens?|uk\\s+womens?)\\b';
const ATC = /^\s*add to (cart|bag)\s*$/i;
const SWATCHES = '[class*="swiper-container"]:has([class*="colorScroller-next"]) .swiper-slide a';
// Header menus hold buttons with the same labels (MENS, WOMENS), so leave the header out.
const PAGE_BUTTON = 'button:not(header button):visible';
const GALLERY = '[class*="gallery"] img, .product-gallery img, .swiper-slide img, img[class*="product"], img[alt*="product"]';

async function load({ page, dismissPopups }, url) {
  await page.goto(url, { waitUntil: 'commit', timeout: 90000 });
  await page.locator('main').first().waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForTimeout(3000);
  await dismissPopups();
}

const productLinks = (page) =>
  page.evaluate(() => [
    ...new Set(
      [...document.querySelectorAll('main a[href$=".html"]')]
        .filter((a) => a.getBoundingClientRect().width > 0)
        .map((a) => a.href),
    ),
  ]);

// Everything the steps need from the PDP as it stands, read in one pass.
const readPdp = (page) =>
  page.evaluate(
    ({ sizeSrc, genderSrc, swatchSel, gallerySel }) => {
      const sizeRe = new RegExp(sizeSrc, 'i');
      const genderRe = new RegExp(genderSrc, 'i');
      const shown = (e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
      };
      const onScreen = (e) => {
        const r = e.getBoundingClientRect();
        return shown(e) && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
      };
      const text = (e) => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim();
      const fixedAncestor = (e) => {
        for (let n = e; n && n !== document.body; n = n.parentElement) {
          const p = getComputedStyle(n).position;
          if (p === 'fixed' || p === 'sticky') return p;
        }
        return null;
      };

      const h1 = [...document.querySelectorAll('h1')].find(shown);
      let priceBox = h1;
      const priceRe = /^\$[\d,]+(\.\d{2})?$/;
      const pricesIn = (root) =>
        [...root.querySelectorAll('*')]
          .filter((e) => e.children.length === 0 && priceRe.test((e.textContent || '').trim()) && shown(e))
          .map((e) => ({
            text: e.textContent.trim(),
            struck: getComputedStyle(e).textDecorationLine.includes('line-through') || !!e.closest('s, del'),
          }));
      let prices = [];
      while (priceBox && priceBox !== document.body && prices.length === 0) {
        priceBox = priceBox.parentElement;
        prices = priceBox ? pricesIn(priceBox) : [];
      }

      // Afterpay renders inside a web component's shadow root.
      const deepText = (node) => {
        let out = '';
        for (const c of node.childNodes) {
          if (c.nodeType === 3) out += c.textContent;
          else if (c.nodeType === 1 && !['STYLE', 'SCRIPT'].includes(c.tagName)) out += ' ' + deepText(c);
        }
        if (node.shadowRoot) out += ' ' + deepText(node.shadowRoot);
        return out;
      };
      const afterpay = [...document.querySelectorAll('*')]
        .filter((e) => e.tagName.includes('-') && /afterpay|square|clearpay/i.test(e.tagName + ' ' + e.className))
        .map((e) => ({ tag: e.tagName.toLowerCase(), shown: shown(e), text: deepText(e).replace(/\s+/g, ' ').trim().slice(0, 160) }));
      const afterpayLight = [...document.querySelectorAll('main *')]
        .filter((e) => e.children.length === 0 && /payments of|afterpay/i.test(e.textContent || '') && shown(e))
        .map(text)
        .slice(0, 3);

      const gallery = [...document.querySelectorAll(gallerySel)].filter((i) => !i.closest('header, footer'));
      const swatches = [...document.querySelectorAll(swatchSel)];
      const sizeButtons = [...document.querySelectorAll('button')].filter((b) => sizeRe.test(text(b)) && shown(b));

      let toggles = [];
      let sizeArea = null;
      if (sizeButtons.length) {
        for (let c = sizeButtons[0].parentElement; c && c !== document.body; c = c.parentElement) {
          const found = [...c.querySelectorAll('button')].filter((b) => genderRe.test(text(b)) && !sizeRe.test(text(b)) && shown(b));
          if (found.length || c.tagName === 'FORM') {
            toggles = found;
            sizeArea = c;
            break;
          }
        }
      }
      const style = (b) => {
        const cs = getComputedStyle(b);
        return {
          label: text(b),
          pressed: b.getAttribute('aria-pressed') ?? b.getAttribute('aria-selected') ?? b.getAttribute('aria-checked'),
          color: cs.color,
          background: cs.backgroundColor,
          weight: cs.fontWeight,
          border: cs.borderBottom,
          cls: (b.className || '').toString().slice(0, 60),
        };
      };

      const atc = [...document.querySelectorAll('button')].filter((b) => /^add to (cart|bag)$/i.test(text(b)));
      const atcShown = atc.filter(shown);
      const soldOut = [...document.querySelectorAll('button')].filter((b) => shown(b) && /notify me|sold out|out of stock/i.test(text(b))).map(text);

      return {
        url: location.href,
        title: document.title,
        name: h1 ? text(h1) : null,
        prices: prices.slice(0, 3),
        afterpay,
        afterpayLight,
        gallery: { shown: gallery.filter(shown).length, onScreen: gallery.filter(onScreen).length, bullets: [...document.querySelectorAll('.swiper-pagination-bullet')].filter(onScreen).length },
        swatches: { count: swatches.length, hrefs: swatches.map((a) => a.href), alts: swatches.map((a) => a.querySelector('img')?.alt || a.getAttribute('aria-label') || a.title || '').slice(0, 6) },
        sizes: {
          labels: sizeButtons.map(text),
          looks: sizeButtons.slice(0, 12).map((b) => `${text(b)}:${b.disabled ? 'disabled' : ''}:${getComputedStyle(b).opacity}:${(b.className || '').toString().split(' ').pop()}`),
          enabled: sizeButtons.filter((b) => !b.disabled && b.getAttribute('aria-disabled') !== 'true').map(text),
          inStock: sizeButtons.filter((b) => b.classList.contains('available')).map(text),
          areaText: sizeArea ? text(sizeArea).slice(0, 240) : null,
        },
        toggles: toggles.map(style),
        atc: atcShown.map((b) => ({
          label: text(b),
          disabled: b.disabled || b.getAttribute('aria-disabled') === 'true',
          onScreen: onScreen(b),
          pinned: fixedAncestor(b),
        })),
        atcHidden: atc.length - atcShown.length,
        soldOut,
      };
    },
    { sizeSrc: SIZE_SRC, genderSrc: GENDER_SRC, swatchSel: SWATCHES, gallerySel: GALLERY },
  );

// Same read as EcommercePDPPage.getMiniCartCount(), plus the label it came from.
const cartBadge = (page) =>
  page.evaluate(() => {
    for (const link of document.querySelectorAll('a[href*="/cart"], [aria-label*="cart" i], [aria-label*="bag" i]')) {
      const r = link.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const label = link.getAttribute('aria-label') || '';
      const m = label.match(/\byou have (\d+) items?\b/i);
      if (m && Number(m[1]) > 0) return { count: Number(m[1]), label };
      for (const el of [link, ...link.querySelectorAll('*')]) {
        if (el.children.length === 0 && /^\d+$/.test((el.textContent || '').trim())) return { count: Number(el.textContent.trim()), label };
      }
      return { count: 0, label };
    }
    return { count: 0, label: null };
  });

// Short visible texts, to see what a click adds to the page (a validation message, a toast).
const visibleTexts = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('body *')]
      .filter((e) => {
        if (e.children.length > 0 && ![...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) return false;
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
      })
      .map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim())
      .filter((t) => t && t.length < 160),
  );

const added = (before, after) => {
  const seen = new Set(before);
  return [...new Set(after.filter((t) => !seen.has(t)))].slice(0, 12);
};

const miniCart = (page) =>
  page.evaluate(() => {
    const panel = [...document.querySelectorAll('aside, [role="dialog"], [role="complementary"]')].find((e) => {
      const r = e.getBoundingClientRect();
      const p = getComputedStyle(e).position;
      return r.width > 0 && r.height > 0 && r.left < innerWidth && r.right > 0 && (p === 'fixed' || p === 'absolute') && /checkout|view (cart|bag)/i.test(e.innerText || '');
    });
    return panel ? (panel.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 220) : null;
  });

const exact = (t) => new RegExp(`^\\s*${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');

// A real click first; if something covers the control, close pop-ups and try once more.
async function tap({ page, dismissPopups }, locator) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await locator.click({ timeout: 8000 });
      return attempt === 1 ? 'click' : 'click-after-popup';
    } catch {
      await dismissPopups();
      await page.waitForTimeout(1500);
    }
  }
  return 'blocked';
}

// Mobile has two Add to Cart buttons: one in the page and one in a bar pinned to the bottom,
// which sits off screen until you scroll and can cover the other. Centre each one and tap the
// first a finger could actually reach.
async function tapAtc(ctx, buttons) {
  const { page } = ctx;
  for (let i = 0; i < (await buttons.count()); i++) {
    const b = buttons.nth(i);
    await b.evaluate((el) => el.scrollIntoView({ block: 'center' })).catch(() => {});
    await page.waitForTimeout(600);
    const reach = await b.evaluate((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= innerHeight) return null;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      let pinned = false;
      for (let n = el; n && n !== document.body; n = n.parentElement) if (getComputedStyle(n).position === 'fixed') pinned = true;
      return { hit: hit === el || el.contains(hit), pinned };
    });
    if (reach?.hit) return { index: i, pinned: reach.pinned, how: await tap(ctx, b) };
  }
  return { how: 'none reachable' };
}

const waitFor = async (page, fn, ms = 15000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return true;
    await page.waitForTimeout(500);
  }
  return false;
};

export default async function collect(ctx) {
  const { page, site, shot } = ctx;
  const origin = new URL(site.url).origin;
  const brand = new URL(site.url).hostname.split('.')[0].replace(/^stag-/, '').replace(/-(au|nz)$/, '');
  const listing = new URL(MEN_LISTING[brand], origin).href;
  const data = { listing, tried: [] };

  await load(ctx, listing);
  await waitFor(page, async () => (await productLinks(page)).length > 0, 20000);
  const links = (await productLinks(page)).slice(0, MAX_PRODUCTS);
  data.listingProducts = links.length;

  let pdp = null;
  let fallback = null;
  for (const href of links) {
    await load(ctx, href);
    await page.locator('h1:visible').first().waitFor({ timeout: 15000 }).catch(() => {});
    await waitFor(page, async () => (await readPdp(page)).sizes.inStock.length > 0, 8000);
    const state = await readPdp(page);
    const buyable = state.sizes.inStock.length > 0 && state.atc.length > 0;
    data.tried.push({ path: new URL(href).pathname, sizes: state.sizes.enabled.length, atc: state.atc.length, swatches: state.swatches.count });
    if (buyable && state.swatches.count >= 2) {
      pdp = state;
      break;
    }
    if (buyable && !fallback) fallback = state;
  }
  if (!pdp && fallback) {
    await load(ctx, fallback.url);
    pdp = await readPdp(page);
  }
  if (!pdp) return { ...data, error: 'no buyable product in the first listing cards' };

  // The Afterpay line renders inside its web component several seconds after the page.
  await waitFor(page, async () => (await readPdp(page)).afterpay.some((a) => /payments of/i.test(a.text)), 20000);
  data.pdp = pdp = await readPdp(page);
  await shot('pdp');
  const pdpUrl = pdp.url;

  // Mobile pins Add to Cart to the bottom on some sites; check it after scrolling.
  await page.evaluate(() => window.scrollBy(0, 1600));
  await page.waitForTimeout(1200);
  data.atcAfterScroll = (await readPdp(page)).atc.map((b) => ({ onScreen: b.onScreen, pinned: b.pinned }));
  await shot('scrolled');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(800);

  // Add to Cart with no size chosen.
  const atcBtn = page.locator(PAGE_BUTTON, { hasText: ATC });
  const cartBefore = await cartBadge(page);
  data.noSize = { disabled: pdp.atc[0].disabled, cartBefore };
  if (!pdp.atc[0].disabled) {
    const before = await visibleTexts(page);
    data.noSize.tap = await tapAtc(ctx, atcBtn);
    await page.waitForTimeout(2500);
    data.noSize.newText = added(before, await visibleTexts(page)).filter((t) => /size/i.test(t));
    data.noSize.cartAfter = await cartBadge(page);
    await shot('no-size');
  }

  // Choose a size that keeps Add to Cart, then add it.
  data.crossedOut = pdp.sizes.labels.filter((l) => !pdp.sizes.inStock.includes(l));
  for (const size of pdp.sizes.inStock.slice(0, 3)) {
    const before = await visibleTexts(page);
    const how = await tap(ctx, page.locator(PAGE_BUTTON, { hasText: exact(size) }).first());
    await page.waitForTimeout(1800);
    const state = await readPdp(page);
    data.sizeChosen = { size, tap: how, atc: state.atc, soldOut: state.soldOut, newText: added(before, await visibleTexts(page)) };
    if (state.atc.length && !state.atc[0].disabled) break;
  }
  await shot('size');
  if (data.sizeChosen?.atc.length && !data.sizeChosen.atc[0].disabled) {
    const before = await visibleTexts(page);
    const startCount = (await cartBadge(page)).count;
    data.addToCart = { tap: await tapAtc(ctx, atcBtn) };
    data.addToCart.incremented = await waitFor(page, async () => (await cartBadge(page)).count > startCount, 20000);
    data.addToCart.cart = { before: startCount, after: await cartBadge(page) };
    data.addToCart.miniCart = await miniCart(page);
    data.addToCart.newText = added(before, await visibleTexts(page));
    await shot('added');
    await ctx.dismissPopups();
  }

  // The size system next to CHOOSE SIZE (US MENS, UK) opens a list. The choice sticks for the
  // rest of the session, so this runs after Add to Cart, and the reload records that it stuck.
  await load(ctx, pdpUrl);
  await waitFor(page, async () => (await readPdp(page)).sizes.labels.length > 0, 15000);
  const system = ((await readPdp(page)).sizes.areaText || '').match(/CHOOSE SIZE\s+(.+?)\s+Size (?:Chart|Guide)/i)?.[1];
  if (system) {
    const ctl = page.getByText(system, { exact: true }).filter({ visible: true }).last();
    data.sizeSystem = { label: system, before: (await readPdp(page)).sizes.labels.slice(0, 6) };
    const before = await visibleTexts(page);
    data.sizeSystem.tap = await tap(ctx, ctl);
    await page.waitForTimeout(1500);
    data.sizeSystem.options = added(before, await visibleTexts(page)).filter((t) => /^(US|UK|EU|AU|CM)( |$)/i.test(t));
    await shot('size-system');
    if (data.sizeSystem.options.includes('EU')) {
      data.sizeSystem.pickTap = await tap(ctx, page.getByText('EU', { exact: true }).filter({ visible: true }).last());
      await page.waitForTimeout(1500);
      const st = await readPdp(page);
      data.sizeSystem.after = { system: (st.sizes.areaText || '').match(/CHOOSE SIZE\s+(.+?)\s+Size/i)?.[1], labels: st.sizes.labels.slice(0, 6) };
      await shot('size-system-eu');
      await load(ctx, pdpUrl);
      await waitFor(page, async () => (await readPdp(page)).sizes.labels.length > 0, 15000);
      data.sizeSystem.afterReload = ((await readPdp(page)).sizes.areaText || '').match(/CHOOSE SIZE\s+(.+?)\s+Size/i)?.[1];
    }
  }

  // Colour swatch: click a different colour and see where it lands.
  await load(ctx, pdpUrl);
  await page.locator('h1:visible').first().waitFor({ timeout: 15000 }).catch(() => {});
  const swatch = page.locator(SWATCHES).filter({ visible: true });
  const count = await swatch.count();
  for (let i = 0; i < count; i++) {
    const href = await swatch.nth(i).evaluate((a) => a.href);
    if (!href || new URL(href).pathname === new URL(pdpUrl).pathname) continue;
    data.swatch = { target: new URL(href).pathname, tap: await tap(ctx, swatch.nth(i)) };
    data.swatch.navigated = await waitFor(page, async () => new URL(page.url()).pathname !== new URL(pdpUrl).pathname, 15000);
    await page.locator('h1:visible').first().waitFor({ timeout: 15000 }).catch(() => {});
    await waitFor(page, async () => (await readPdp(page)).gallery.shown > 0, 15000);
    await page.waitForTimeout(1500);
    const landed = await readPdp(page);
    data.swatch.landed = new URL(page.url()).pathname;
    data.swatch.name = landed.name;
    data.swatch.title = landed.title;
    data.swatch.gallery = landed.gallery;
    data.swatch.linksBack = landed.swatches.hrefs.some((h) => new URL(h).pathname === new URL(pdpUrl).pathname);
    data.swatch.swatchCount = landed.swatches.count;
    await shot('swatch');
    break;
  }
  return data;
}
