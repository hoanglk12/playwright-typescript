// TEST-878 collector: top bar, header and footer colours, header layout and the sticky header.
// Copy this file as the starting point for another card's collector.
export default async function collect({ page, viewport, styles, scrollToFooter, shot }) {
  const desktop = viewport === 'desktop';
  const header = page.locator('header').first();
  const topBar = page.locator(desktop ? '.top-header-desktop' : '.top-header-mobile').first();
  // Some controls have a hidden twin with the same label (desktop mini cart), so any visible match counts.
  const visible = (name) =>
    header.evaluate(
      (h, n) =>
        [...h.querySelectorAll('[aria-label]')].some((e) => {
          const r = e.getBoundingClientRect();
          return e.getAttribute('aria-label').startsWith(n) && r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
        }),
      name,
    );
  await shot('top');

  const data = {
    title: await page.title(),
    topBar: (await styles(topBar)).background,
    header: (await styles(header)).background,
    menuButton: await visible('Toggle navigation panel'),
    wishlist: await visible('Toggle Wishlist'),
    account: await visible('Toggle My Account'),
    cart: await visible('Toggle mini cart'),
    searchInHeader: await header.getByPlaceholder(/looking for|find products/i).count() > 0,
  };
  if (desktop) data.mensLink = (await styles(header.getByRole('link', { name: /^MENS?$/i }))).color;

  await scrollToFooter();
  data.headerTopAfterScroll = Math.round((await header.boundingBox()).y);
  const contact = await styles(page.locator('footer').getByRole('link', { name: /^contact us$/i }));
  data.footerLink = contact.color;
  data.footerBackground = contact.backgroundBehind;
  await shot('footer');
  return data;
}
