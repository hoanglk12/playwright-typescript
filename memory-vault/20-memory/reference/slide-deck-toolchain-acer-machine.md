---
name: slide-deck-toolchain-acer-machine
description: "How to build and render-check a PPTX on the ACER machine (no LibreOffice, no global pptxgenjs; PowerPoint 16 COM works) and the Superdesign presentation gotchas found building the GRA automation pitch deck"
type: reference
tags: [memory, reference]
last_verified: 2026-10-21
---

Building the GRA automation pitch deck for Ricardo (2026-10-21) found this about the `E:\OLDDATA\...` (ACER) machine:

- **No LibreOffice, no `pdftoppm`, no global `pptxgenjs` / `markitdown`.** The pptx skill's `soffice.py` render step cannot run. Install `pptxgenjs react-icons react react-dom sharp` into a scratchpad folder, never the repo, and run the build with `NODE_PATH=<that>/node_modules` so the skill's `apply_theme.js` can resolve `pptxgenjs`. Put Python QA deps (`defusedxml lxml Pillow markitdown[pptx]`) in a scratchpad venv.
- **PowerPoint 16 is installed and its COM object works** (`New-Object -ComObject PowerPoint.Application`, `Presentations.Open(path, -1, 0, 0)`, `Slides.Item(i).Export(png, "PNG", 1600, 900)`). Use it for visual QA. It renders with the real fonts, which makes it more trustworthy than LibreOffice.
- **Superdesign `create-presentation` silently drops and rewrites approved content.** It dropped a whole comparison row and step descriptions, and once reversed a sentence's meaning ("identifying" for "hiding" the GRA-5967 symptom). Always diff the generated slide text against the approved outline. Fix drift with `get-design --output` → edit → `import-design-draft --into <draft> --outline-file ...`, which costs no credits and is revertible.
- **Check deck claims against `.github/workflows/`, not memory.** Test results go to Slack only. Teams is only the Platypus Bitbucket Lighthouse pipeline. See [[project_context]].

Deck artifacts: Superdesign project "GRA Automation Stack Pitch" (draft `eed49d8c-f33e-41c9-a51a-3a5d1cfe1190`, v4); logo Brand Asset key `accent-group-logo`.
