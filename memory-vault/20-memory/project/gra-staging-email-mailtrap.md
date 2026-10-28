---
name: gra-staging-email-mailtrap
description: "GRA staging transactional email is NOT trapped in Mailtrap — Platypus AU staging delivered a password-reset email to an external yopmail inbox in under a minute (live-verified 2026-10-28); full forgot-password E2E (TEST-884) works with any real external inbox"
type: project
tags: [memory, project, email, staging]
last_verified: 2026-10-28
---

## GRA staging delivers transactional email to real external inboxes (live-verified 2026-10-28)

On Platypus AU staging, a fresh account at `qapla.reset<ts>@yopmail.com` asked for a password reset through the UI. The reset email reached the public yopmail inbox in under a minute, and the whole TEST-884 flow passed end to end: wrong-password error → forgot → email → link → new password → login.

**Correction:** earlier the same day this note said all GRA staging mail lands in a catch-all Mailtrap sandbox. That came from TUU-31 (Timberland UAT, 2024, webqem) and an answer the user gave before testing it. The live probe proved it wrong for Platypus AU. Mailtrap capture may still apply to Timberland, but don't assume it for GRA. The other 7 GRA storefronts are unverified, so probe one before relying on delivery there.

**Why:** It decides how any email-dependent test reads mail (forgot password, order confirmation, registration). External inbox services (yopmail, Mailinator, Mailosaur, MailSlurp, Gmail API) all receive staging mail. No Mailtrap token is needed.

**How to apply:**
- Facts from the probe, for automation:
  - Sender: `CustomerSupport <support@accentgra.com>`. Subject: "Reset your password".
  - The link expires in **30 minutes**, a customised value (Magento's default is 2 h).
  - Link format: `https://stag-platypus-au.accentgra.com/customer/account/createPassword/?token=<32 chars>`. It is token-only (no `id`/`email` params) and the host is correct.
- Forgot-password UI on Platypus AU:
  - "Forgot your password?" is a plain `generic` element, not a link or button, so use `getByText`.
  - The panel has heading "Forgot your password?" (h2) and buttons "Send" / "Cancel".
  - The email input has no accessible name.
  - After Send it shows the generic confirmation "If there is an account associated with {email} you will receive an email…". `requestPasswordResetEmail` goes as a POST and returned `true`, with no reCAPTCHA token sent.
- The wrong-password error includes an inline "reset your password" link.
- Reset page:
  - heading "Set a new password" (h1)
  - email input + `input[name="newPassword"]`
  - button "reset"
  - password rule: ≥8 characters, 1 uppercase, 1 digit
  - On success it shows "Your password has been updated." and redirects home with the login panel open.
- Yopmail and Mailinator inboxes are public, so anyone can read a reset link sent there. That is acceptable only for disposable accounts. Note that `createFreshAccountCredentials()` already uses `@mailinator.com`.
- Magento reset throttling was not probed (only one request was made); see [[gra-api-testing]].
