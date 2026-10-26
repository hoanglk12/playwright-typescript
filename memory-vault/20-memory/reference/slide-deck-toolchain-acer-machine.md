---
name: slide-deck-toolchain-acer-machine
description: "How to build and render-check a PPTX on the ACER machine (no LibreOffice, no global pptxgenjs; PowerPoint 16 COM works) and the Superdesign presentation gotchas found building the GRA automation pitch deck"
type: reference
tags: [memory, reference]
last_verified: 2026-10-24
---

Building the GRA automation pitch deck for Ricardo (2026-10-21) found this about the `E:\OLDDATA\...` (ACER) machine:

- **No LibreOffice, no `pdftoppm`, no global `pptxgenjs` / `markitdown`.** The pptx skill's `soffice.py` render step cannot run. Install `pptxgenjs react-icons react react-dom sharp` into a scratchpad folder, never the repo, and run the build with `NODE_PATH=<that>/node_modules` so the skill's `apply_theme.js` can resolve `pptxgenjs`. Put Python QA deps (`defusedxml lxml Pillow markitdown[pptx]`) in a scratchpad venv.
- **PowerPoint 16 is installed and its COM object works** (`New-Object -ComObject PowerPoint.Application`, `Presentations.Open(path, -1, 0, 0)`, `Slides.Item(i).Export(png, "PNG", 1600, 900)`). Use it for visual QA. It renders with the real fonts, which makes it more trustworthy than LibreOffice.
- **Superdesign `create-presentation` silently drops and rewrites approved content.** It dropped a whole comparison row and step descriptions, and once reversed a sentence's meaning ("identifying" for "hiding" the GRA-5967 symptom). Always diff the generated slide text against the approved outline. Fix drift with `get-design --output` → edit → `import-design-draft --into <draft> --outline-file ...`, which costs no credits and is revertible.
- **Check deck claims against `.github/workflows/`, not memory.** Test results go to Slack only. Teams is only the Platypus Bitbucket Lighthouse pipeline. See [[project_context]].
- **When a slide exists in both the Superdesign HTML and the PPTX, generate both from one JSON file.** Slide 3 (tool comparison) now does this: `pptx-build/slide3-data.json` feeds `gen_slide3.py` (HTML) and `build-deck.js` (PPTX), so the two versions cannot drift apart.
- **Superdesign slides are sized to the viewer's window, not to a fixed canvas.** Check dense slides at 1280×720 as well as 1600×900. A table with fixed `px` fonts fits at 900 but overflows under the banner at 720. A `clamp(10px, 0.82vw, 14px)` font plus `em` padding fixes it. To grow the text on big screens instead of leaving empty space, `clamp(11px, min(calc(1.25vw - 5px), calc(2.22vh - 5px)), 15px)` gives 11px at 1280×720 and 15px at 1600×900; a plain `vw` term can't hit both. Playwright MCP blocks `file://`, so preview a local deck through `python -m http.server`.
- **Tool-comparison cells must cite the vendor's own docs** (no comparison sites or "X vs Y" pages). Mark "not documented" as partial, never as a "no". Cypress's own cross-origin guide names Braintree card forms as an iframe it cannot automate. Playwright's docs never say "cross-origin", so the Playwright tick rests on this repo's `creditcard-checkout.spec.ts` / `paypal-checkout.spec.ts`. That spec proves the hosted-field fill and tokenization only; card order placement is intermittent for a Magento-side reason (see [[gra-card-checkout-placeorder-blocker]]), so claim "works in our suite", never "card checkout passes".

Deck artifacts: Superdesign project "GRA Automation Stack Pitch" (draft `eed49d8c-f33e-41c9-a51a-3a5d1cfe1190`, v14, 9 slides; slide 6 is the knowledge layer, deliberately without a speed claim, see [[lightrag-eval]]); logo Brand Asset key `accent-group-logo`.
