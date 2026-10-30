---
name: revise-xray-test-case
description: Revise one test card in the GRA-5621 E2E traceability report (Guideline/GRA-5621-e2e-traceability.html) into automation-ready Xray manual steps, the way TEST-878 (Desktop - Homepage) was done. Automated scenarios are kept and Planned ones skipped, every value is confirmed on all 8 GRA staging sites on desktop and mobile, the steps are written in plain language with key text in bold, and the result is spliced into the card as a "Proposed Xray steps" block. Use this whenever the user asks to revise, rewrite, redo, clean up or update the Xray steps of a TEST-xxx or GRA-xxxx card in that report, says "do the same as TEST-878" or "next test case", or wants a card's steps made automation friendly or human readable. It edits the HTML report only; it doesn't push to Xray or Jira.
---

# Revise an Xray test card in the GRA-5621 traceability report

The finished TEST-878 card is the standard. Read `references/test-878-example.html` before writing anything. It shows the exact markup, tone, level of detail and bolding the user signed off on after several rounds of corrections.

The report is about 230 KB and each card is one or two very long lines. Don't Read the whole file. Find a card with `grep -n "id='KEY'"` and print that line, or let the scripts below work on it.

## Workflow

### 1. Read the card

From `<article class='test' id='KEY'>` take the title, the scenario table (ID, title, sites, Status in report, spec), the gap note and the transcribed Xray steps. Note the area (homepage, PLP, PDP, cart, account, checkout), because it decides which page the exploration loads.

### 2. Decide the scope

- Keep scenarios whose status is **Automated**. Skip **Planned**, Blocked and Retired ones. This was the user's first rule for TEST-878.
- Add the new checks the user names (for TEST-878: header and footer theme colour, distinguished per site). If they name none, propose 2 to 4 checks that fit the card's title and gap note, and confirm before exploring.
- If the card needs something a guest can't do safely on staging (placing an order, paying, signing in, Magento admin, the Forter portal, AP21), stop and ask. While exploring, never enter credentials, submit a payment, place an order or sign up to a newsletter. For signed-in cards, follow the gra-storefront-investigation skill: the user signs in themselves.

### 3. Explore all 8 staging sites on desktop and mobile

Every expected value in the card has to come from what the sites show today, not from memory or from the report.

1. Write a collector for the card. `scripts/collectors/header-footer-theme.mjs` (the TEST-878 one) is the pattern.
2. Run it in the background (16 page loads take a few minutes):
   ```
   node .claude/skills/revise-xray-test-case/scripts/probe-sites.mjs <collector.mjs> --out <scratchpad>/<KEY>.json --shots <scratchpad>/<KEY>-shots [--path /some/page]
   ```
   It reads the storefronts from `src/data/ecommerce/storefronts.ts`, loads each one at Desktop 1440 × 900 and iPhone 15 (in Chromium), and passes the collector `styles()`, `scrollToFooter()`, `dismissPopups()` and `shot()` helpers. `collectors/main-navigation.mjs` (TEST-887) shows how to walk through menus and retry a tap that a pop-up blocks.
3. Look at screenshots, at least one per brand, before trusting the numbers.
4. Run it twice. Keep a check only when every site gives the same answer both times.

### 4. Keep only what's easy to automate

Keep a check when it has a stable anchor (a button's accessible name, a stable class such as `.top-header-mobile`, consistent link text) and a fixed expected value per site or per brand.

Drop the following, and say so in chat rather than in the card:
- CMS or campaign content: promo wording and thresholds, hero banners, campaign-coloured nav links (SALE, OUTLET, BLACK FRIDAY), footer columns, social icons, copyright lines, newsletter forms.
- Visual-only judgements, such as whether the logo looks right.
- Anything another GRA-5621 card already covers (search is TEST-886, navigation TEST-887, newsletter TEST-892).

A short list of steps a test can run reliably is the goal. TEST-878 went from 12 proposed steps to 7.

### 5. Write the block

Follow the shape of `references/test-878-example.html`:
- `<details class='xsteps proposed' open>`, with the summary `Proposed Xray steps · N steps, each run on Desktop and Mobile · drafted YYYY-MM-DD, trimmed for automation · not yet in Xray`.
- A precondition that ends with this sentence, word for word: "Run every step twice: once on Desktop (browser window 1440 × 900) and once on Mobile (Phone 15 emulation)." The user chose "Phone 15", so don't change it to iPhone. Guest cards start with "Use a guest session (not signed in)."
- An "Expected ..." reference table, only when values differ per brand or site (colours, labels, hint text). Colours read like "Dark grey `#222222`" with a swatch span in front.
- A steps table with the columns `#`, `Action`, `Data`, `Expected Result`, one check per step. Each step covers both views. Where desktop and mobile differ, the Expected Result says "On desktop, ..." and "On mobile, ...".

Writing rules (these are the user's corrections on TEST-878):
- Plain language a manual tester can follow. No selectors, class names, config or file names, function names, CSS property names, regexes or scenario IDs, and no "Automated" or "New" labels. Use `<code>` only for hex colours.
- Describe what's on screen using real staging values: full URLs, browser tab titles, link and button labels, hint text and messages in straight quotes, and colour names with their hex.
- The block holds the precondition, the reference table and the steps, nothing else. No "replaces ..." or "dropped ..." notes, no "seen while drafting" bug lists, no notes about cookie banners or pop-ups.
- Run the text past the humanizer skill: no em or en dashes, straight quotes, short direct sentences.
- Bold what a tester has to check: "guest session", "every step twice", "Desktop", "Mobile", site names in the Data column, the pass or fail phrases in the Expected Result, exact on-screen text, and "On desktop," / "On mobile,". Leave explanations and examples unbolded.

### 6. Splice it into the card and check it

```
python .claude/skills/revise-xray-test-case/scripts/splice-card.py Guideline/GRA-5621-e2e-traceability.html KEY <block.html>
node .claude/skills/revise-xray-test-case/scripts/check-card.mjs Guideline/GRA-5621-e2e-traceability.html KEY --shots <scratchpad>
```

`splice-card.py` inserts the block above the transcribed steps and renames them "Current Xray steps". If the card already has a proposed block, it replaces it, so re-running is safe. `check-card.mjs` lints the block against the writing rules and renders the card at desktop (light) and phone (dark) widths. Fix every FAIL, then look at the screenshot yourself.

### 7. Report, then stop

In chat, tell the user which steps were kept, what was dropped and why, any site bugs noticed (to raise separately), and any automation gap found, for example a page-object method that only reads the desktop layout. Don't push to Xray, change test code or commit unless the user asks. Pushing to Xray is the create-xray-test-web skill's job.

If the user asks whether a step can really be automated, prove it with a real test run: see `references/proof-run.md`.

## Gotchas seen on GRA staging

- Desktop renders `.top-header-desktop` and phones render `.top-header-mobile`, never both. Code that reads only one of them fails on the other view.
- Footers render lazily, so scroll to the bottom before reading them (`scrollToFooter()` does this).
- The top bar rotates its messages every few seconds. Wait or poll for a message instead of reading once.
- Vans AU on mobile opens a "Join The Crew" sign-up pop-up. Escape doesn't close it, and it blocks every tap, including the logo. Call `dismissPopups()` after each page load and before retrying a tap. It clicks the same close buttons as the framework's overlay helper.
- Mobile menus differ by brand. The category entries (WOMEN, MEN, KIDS, SALE) are buttons that open a section of the menu, not links, and the sections hold CMS tiles that differ even between the AU and NZ sites of one brand. Don't build a step around a path through them. What stays stable: the category is listed, and tapping it keeps you on the homepage.
- Off-canvas panels have a size but sit off screen. When comparing what's visible before and after a tap, count only elements inside the viewport.
- Some header controls have a hidden twin with the same label (the desktop mini cart button). Check whether any match is visible, not just the first one, or the probe reports a visible icon as missing.
- On desktop, the Skechers, Vans and Dr. Martens footer panels only have generated class names. Read the colour from the nearest coloured ancestor of a stable link (`styles().backgroundBehind`).
- The AU and NZ sites of a brand share a theme, but labels differ per site (MENS or MEN; "Contact Us", "Contact us" or "CONTACT US"). `storefronts.ts` already holds many of them.
- Five sites have generic tab titles on staging ("Home page", "Homepage", "Home page nz").
- Playwright's `iPhone 15` device defaults to WebKit. The scripts drop `defaultBrowserType` and run it in Chromium.
- The report uses CRLF line endings. The scripts keep them.
