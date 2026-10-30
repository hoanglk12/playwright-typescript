// TEST-879 collector: the product grid and its count, the category and size filters, Quick Add,
// and the card click through to the PDP. Each part reloads the listing page so one part's state
// (an applied filter, an open size panel) can't leak into the next.

// The listing page the PLP tests reach through the nav, and their filter labels (storefronts.ts).
const PLP = {
  'platypus-au': { path: '/shop/womens', category: 'Footwear', size: '7' },
  'platypus-nz': { path: '/shop/mens', category: 'Footwear', size: '7' },
  'skechers-au': { path: '/shop/women', category: 'Footwear', size: '7' },
  'skechers-nz': { path: '/shop/women', category: 'Footwear', size: '7' },
  'vans-au': { path: '/shop/womens', category: 'Low Top', size: '7' },
  'vans-nz': { path: '/shop/womens', category: 'Old Skool', size: '7' },
  'drmartens-au': { path: '/shop/women', category: 'Boots', size: '4' },
  'drmartens-nz': { path: '/shop/women', category: 'Boots', size: '4' },
};

const CARD = '[data-product-id]';
const QUICK_ADD = '[data-product-id] button[class*="quick-add"]';
const SIZE_BUTTON = 'button.available';
// On phones the filters sit behind a "Filter & Sort (0)" bar, which is a paragraph, not a button.
const FILTER_OPENER = /^\s*filter\s*&\s*sort/i;
const SEE_RESULTS = /^\s*see results/i;

const text = (s) => (s || '').replace(/\s+/g, ' ').trim();

async function load({ page, dismissPopups }, url) {
  await page.goto(url, { waitUntil: 'commit', timeout: 90000 });
  await page.locator('main').first().waitFor({ state: 'visible', timeout: 60000 });
  await page.locator(CARD).first().waitFor({ state: 'attached', timeout: 60000 });
  await page.waitForTimeout(3000);
  await dismissPopups();
}

// The "N Products" line the tests read, as the page shows it.
const countLine = (page) =>
  page.evaluate(() => {
    for (const p of document.querySelectorAll('p')) {
      const m = (p.textContent || '').trim().match(/^(\d+)\s+Products$/i);
      if (m) return { n: Number(m[1]), shown: p.innerText.trim() };
    }
    return null;
  });

async function waitForCountBelow(page, initial, ms = 25000) {
  const end = Date.now() + ms;
  let last = null;
  while (Date.now() < end) {
    last = await countLine(page);
    if (last && last.n > 0 && last.n < initial) return last;
    await page.waitForTimeout(500);
  }
  return last;
}

// Every filter option with this label, and the headings above it. A group's heading is the first
// child of its container (the option list comes after it), e.g. "Categories" or "Size Chart Size UK".
// With no label it returns every option, so the caller can list the groups.
const optionsLabelled = (page, label) =>
  page.evaluate((wanted) => {
    // "Footwear 162" is the option and its product count; a size option is just "7".
    const own = (input) => text(input.labels?.[0]?.innerText || '').replace(/\s+\d+$/, '');
    function text(s) { return (s || '').replace(/\s+/g, ' ').trim(); }
    return [...document.querySelectorAll('input[type=checkbox], input[type=radio]')]
      .filter((input) => !wanted || own(input).toLowerCase() === wanted.toLowerCase())
      .map((input) => {
        const headings = [];
        let node = input;
        for (let i = 0; i < 9 && node; i++) {
          node = node.parentElement;
          const head = node && node.firstElementChild;
          if (!head || head.querySelector('input')) continue;
          const t = text(head.textContent);
          if (t && t.length < 30 && t.toLowerCase() !== own(input).toLowerCase() && !headings.includes(t)) headings.push(t);
        }
        const r = input.closest('label')?.getBoundingClientRect();
        return { type: input.type, label: text(input.labels?.[0]?.innerText), headings, shown: !!r && r.width > 0 && r.height > 0 };
      });
  }, label);

async function applyFilter(ctx, name, exact) {
  const { page, viewport, dismissPopups, shot } = ctx;
  const out = { before: await countLine(page) };
  if (viewport === 'mobile') {
    const opener = page.getByText(FILTER_OPENER).filter({ visible: true }).first();
    out.opener = (await opener.count()) ? text(await opener.innerText()) : null;
    if (out.opener) {
      await opener.click({ timeout: 10000 }).catch(async () => {
        await dismissPopups();
        await opener.click({ timeout: 10000 }).catch((e) => (out.openerError = e.message.split('\n')[0]));
      });
      await page.waitForTimeout(1500);
    }
  }
  out.options = await optionsLabelled(page, name);
  const groups = {};
  for (const o of await optionsLabelled(page, '')) {
    const g = (groups[o.headings[0]] ||= { options: 0, first: [] });
    g.options++;
    if (g.first.length < 4) g.first.push(o.label);
  }
  out.groups = groups;
  const checkbox = page.getByRole('checkbox', exact ? { name, exact: true } : { name: new RegExp(name, 'i') }).first();
  const anyInput = (await checkbox.count()) ? checkbox : page.getByRole('radio', { name: new RegExp(name, 'i') }).first();
  if (!(await anyInput.count())) {
    out.found = false;
    await shot(`filter-missing-${name}`);
    return out;
  }
  out.found = true;
  // The option the tests tick (the first match), and the group heading above it.
  out.picked = (await optionsLabelled(page, name))[0] || null;

  // Click the way a shopper would: the visible label, opening its group first if it is collapsed.
  const label = anyInput.locator('xpath=ancestor::label[1]');
  const target = (await label.count()) ? label : anyInput;
  if (!(await target.isVisible())) {
    out.groupWasCollapsed = true;
    const heading = out.picked?.headings?.[0];
    if (heading) {
      const head = page.getByText(heading.replace(/^Size Chart\s*/i, ''), { exact: false }).filter({ visible: true }).first();
      await head.click({ timeout: 10000 }).catch((e) => (out.groupOpenError = e.message.split('\n')[0]));
      await page.waitForTimeout(800);
    }
  }
  await target.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
  out.clickedVisibly = await target.click({ timeout: 10000 }).then(() => true).catch(() => false);
  if (!out.clickedVisibly) await anyInput.evaluate((el) => el.click());
  await page.waitForTimeout(2000);

  if (viewport === 'mobile') {
    const see = page.getByText(SEE_RESULTS).filter({ visible: true }).first();
    out.seeResults = (await see.count()) ? text(await see.innerText()) : null;
    await shot(`filter-panel-${name}`);
    if (out.seeResults) {
      await see.click({ timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1500);
    }
  }
  out.after = out.before ? await waitForCountBelow(page, out.before.n) : await countLine(page);
  out.urlAfter = new URL(page.url()).pathname + new URL(page.url()).search;
  out.openerAfter = viewport === 'mobile' ? await page.getByText(FILTER_OPENER).filter({ visible: true }).first().innerText().then(text).catch(() => null) : undefined;
  await shot(`filter-${name}`);
  return out;
}

async function quickAdd(ctx, index) {
  const { page, viewport, dismissPopups, shot } = ctx;
  const card = page.locator(CARD).nth(index);
  await card.scrollIntoViewIfNeeded();
  const qa = card.locator('button[class*="quick-add"]').first();
  const out = { product: text(await card.innerText()).replace(/^.*?(quick add|add to cart)\s*/i, '').slice(0, 80) };
  if (viewport === 'desktop') {
    out.visibleBeforeHover = await qa.isVisible();
    await card.hover();
    await page.waitForTimeout(600);
  }
  out.visible = await qa.isVisible();
  out.label = text(await qa.innerText().catch(() => '')) || (await qa.getAttribute('aria-label'));
  out.clicked = await qa.click({ timeout: 10000 }).then(() => true).catch(async () => {
    await dismissPopups();
    await card.hover().catch(() => {});
    return qa.click({ timeout: 10000 }).then(() => true).catch((e) => e.message.split('\n')[0]);
  });
  // Sizes come from a stock lookup after the panel opens, so give them time.
  const started = Date.now();
  const sizes = page.locator(`${SIZE_BUTTON}:visible`);
  while (Date.now() - started < 12000 && !(await sizes.count())) await page.waitForTimeout(500);
  out.sizesMs = Date.now() - started;
  out.sizes = (await sizes.allInnerTexts()).map(text).slice(0, 10);
  out.addToCartShown = await page.getByRole('button', { name: /^\s*add to cart\s*$/i }).filter({ visible: true }).count();
  out.sizeHeadings = (await page.getByText(/^\s*size\b/i).filter({ visible: true }).allInnerTexts()).map(text).slice(0, 4);
  await shot(`quick-add-${index}`);
  return out;
}

export default async function collect(ctx) {
  const { page, site, viewport, shot, dismissPopups } = ctx;
  const cfg = PLP[site.id];
  const url = new URL(cfg.path, site.url).href;
  const data = { path: cfg.path };

  // Grid and count.
  try {
    await load(ctx, url);
    data.title = await page.title();
    data.h1 = (await page.locator('h1:visible').allInnerTexts()).map(text);
    data.landed = new URL(page.url()).pathname;
    data.cards = await page.locator(CARD).count();
    data.count = await countLine(page);
    data.showing = await page.getByText(/^\s*showing \d+ of \d+/i).first().innerText().then(text).catch(() => null);
    data.columns = await page.locator(CARD).evaluateAll((cards) => {
      const top = Math.round(cards[0].getBoundingClientRect().top);
      return cards.filter((c) => Math.round(c.getBoundingClientRect().top) === top).length;
    });
    data.sort = await page.getByText(/^\s*sort by/i).first().locator('xpath=..').innerText().then(text).catch(() => null);
    await shot('grid');
  } catch (e) {
    data.gridError = e.message.split('\n')[0];
  }

  // Quick Add on the first two cards: some products have no sizes in stock.
  data.quickAdd = [];
  for (const i of [0, 1]) {
    try {
      await load(ctx, url);
      data.quickAdd.push(await quickAdd(ctx, i));
    } catch (e) {
      data.quickAdd.push({ error: e.message.split('\n')[0] });
    }
  }

  // Category filter, then size filter, each from a fresh page.
  for (const [key, name, exact] of [['category', cfg.category, false], ['size', cfg.size, true]]) {
    try {
      await load(ctx, url);
      data[key] = await applyFilter(ctx, name, exact);
    } catch (e) {
      data[key] = { error: e.message.split('\n')[0] };
      await shot(`filter-error-${key}`);
    }
  }

  // Card image click to the PDP.
  try {
    await load(ctx, url);
    const card = page.locator(CARD).first();
    await card.scrollIntoViewIfNeeded();
    await dismissPopups();
    data.pdp = { href: await card.locator('a[href$=".html"]').first().getAttribute('href') };
    // The image is a looping carousel with off-card clones, so click the slide that is on the card.
    const point = await card.evaluate((c) => {
      const box = c.getBoundingClientRect();
      const img = [...c.querySelectorAll('img')].find((i) => {
        const r = i.getBoundingClientRect();
        const x = r.left + r.width / 2;
        return r.width > 80 && x > box.left && x < box.right;
      });
      if (!img) return null;
      const r = img.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, alt: img.getAttribute('alt'), inLink: !!img.closest('a') };
    });
    data.pdp.image = point && { alt: point.alt, inLink: point.inLink };
    await page.mouse.click(point.x, point.y);
    await page.waitForURL((u) => u.pathname !== new URL(url).pathname, { timeout: 30000 });
    await page.locator('h1').first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
    data.pdp.landed = new URL(page.url()).pathname;
    data.pdp.h1 = (await page.locator('h1:visible').allInnerTexts()).map(text);
    data.pdp.title = await page.title();
    data.pdp.addToCart = await page.getByRole('button', { name: /add to (cart|bag)/i }).filter({ visible: true }).count();
    await shot('pdp');
  } catch (e) {
    data.pdpError = e.message.split('\n')[0];
    await shot('pdp-error');
  }
  return data;
}
