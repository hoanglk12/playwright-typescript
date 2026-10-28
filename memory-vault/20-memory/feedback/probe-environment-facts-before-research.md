---
name: probe-environment-facts-before-research
description: "Before dispatching research that hinges on an environment fact (where staging mail goes, whether a feature is enabled), test it live if the check takes minutes — a recalled answer sank a full TEST-884 research report"
type: feedback
tags: [memory, feedback, research, staging]
last_verified: 2026-10-28
---

## Probe cheaply checkable environment facts live before building research on them

TEST-884 (forgot password, 2026-10-28): the research brief rested on "GRA staging mail all goes to Mailtrap". That came from TUU-31, a 2024 Timberland defect, plus the user's answer to a question about it. The research agent spent about 20 minutes building a Mailtrap-API-centred recommendation. Then a 5-minute live probe showed the opposite. A fresh Platypus AU account with a yopmail address received the reset email in under a minute, and the full flow passed. See [[gra-staging-email-mailtrap]].

**Why:** Recollection, an old ticket from another brand, or an answer typed into a multiple-choice prompt are weaker evidence than one live check. When the whole recommendation depends on one fact, getting that fact wrong makes the entire report obsolete, not just one section.

**How to apply:**
- If a research or design decision hinges on one environment fact, and checking it costs minutes (create a fresh account, trigger the action, look at the result), check it before dispatching research. Don't ask the user to recall it.
- Ask the user only when the probe is expensive, destructive, or needs access you don't have, and treat the answer as unverified in the brief.
- Scope a probe's conclusion to what was actually tested. Here that was one storefront, Platypus AU. Each brand has its own Magento admin host, so mail config can differ per brand.
- Related, same theme: [[ecommerce-header-help-gotcha]]. A sub-agent with no live browser produced a false negative.
