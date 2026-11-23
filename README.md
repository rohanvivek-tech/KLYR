# KLYR — Protein, minus the shake.

Website for **KLYR Protein Water**, a pre-launch ready-to-drink protein water brand from Bengaluru.

A static site (plain HTML, CSS and JavaScript — no build step) with a waitlist, accounts (log in, sign up and password reset via Supabase) and legal page templates.

## Preview locally

```bash
node .claude/serve.js
```

Then open http://localhost:5173. Open the site through this local server rather than double-clicking the HTML files, so styles and forms work properly.

## Pages

| Page | File |
|---|---|
| Home | `index.html` |
| The Drink | `product.html` |
| Why KLYR | `why.html` |
| Our Story | `story.html` |
| Waitlist | `waitlist.html` |
| Log in / Sign up | `login.html` |
| Account | `account.html` |
| Reset password | `reset.html` |
| Contact | `contact.html` |
| Privacy / Terms | `privacy.html`, `terms.html` |

## Connecting Supabase

Accounts and waitlist storage need a Supabase project. Follow [SUPABASE_SETUP.md](SUPABASE_SETUP.md), then add your project URL and **anon** key to `assets/js/config.js`.

## Before launch

- Fill in the placeholders on `contact.html`, `privacy.html` and `terms.html`, and have the legal pages reviewed.
- All nutrition values and product details are proposed targets until formulation and testing are complete.
