# DigiFox Pro Solutions website

Source of **https://digifoxprosolutions.com/** (hosted on Hostinger).

- `public_html/` mirrors the website's `public_html` folder for the files kept here.
  Files kept so far: `index.html`, `our-services/index.html`, `quiz/index.html`, `quiz/send.php`, `js/quiz.js`.
- When a change under `public_html/` is merged into `main`, the **Publish website** GitHub
  Action uploads those files (and only those) to Hostinger. It first backs up each old file to
  `~/website-backups/<date-time>/` on the server, and stops instead of overwriting a page that
  was edited on the server in the meantime. After each upload it records the published pages'
  fingerprints in `~/website-backups/published.sha256` on the server, which the next publish
  checks against (`live-base.sha256` is only a fallback for pages not recorded there yet). It then checks the live pages for the tracking tags.
- The CRM at crm.digifoxprosolutions.com lives in the separate `digi-crm` repository and is
  never touched by this one.

## One-time setup
Repository **Settings → Secrets and variables → Actions → New repository secret**:
- `HOSTINGER_HOST`: the SSH IP from hPanel → Advanced → SSH Access
- `HOSTINGER_PASSWORD`: the SSH password (or `HOSTINGER_SSH_KEY`: a private key)
- `INFO_MAIL_PASSWORD`: the password of the info@digifoxprosolutions.com mailbox. The quiz
  mailer (`quiz/send.php`) sends through Hostinger SMTP with it, so its emails are signed and
  don't land in spam. Each publish writes it to `~/.digifox-smtp-password` on the server (outside
  `public_html`); without it the quiz emails fall back to PHP `mail()`.

Optional variables: `HOSTINGER_USER` (u311568037), `HOSTINGER_PORT` (65002),
`WEBSITE_ROOT` (domains/digifoxprosolutions.com/public_html).

## Tracking (inside every page's `<head>`)
Google Analytics `G-JCKWC42TF9` · Microsoft Clarity `w8uxl1npqn` · Meta Pixel `2137139433844948`
