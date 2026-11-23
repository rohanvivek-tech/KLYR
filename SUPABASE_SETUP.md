# Connecting KLYR to Supabase

Supabase runs the KLYR accounts (log in, sign up, password reset) and stores waitlist sign-ups. Setup takes about 10 minutes, and the free plan is enough.

## 1. Create a project

1. Sign up at [supabase.com](https://supabase.com) and click **New project**.
2. Name it `klyr`, choose a strong database password and save it somewhere safe.
3. For region, pick **Mumbai (ap-south-1)**, the closest to Bengaluru.

## 2. Create the waitlist table

1. In your project, open **SQL Editor** → **New query**.
2. Paste in everything from [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.

This creates the `waitlist` table. Visitors can add themselves to it, but nobody can read the list from the website. You can see sign-ups under **Table Editor → waitlist**, and export them to CSV from there.

## 3. Add your keys to the website

1. Go to **Project Settings → API**.
2. Open [`assets/js/config.js`](assets/js/config.js) and paste in:
   - **Project URL** → `supabaseUrl`
   - **anon public** key → `supabaseAnonKey`

The anon key is meant to be public. **Never** use the `service_role` key on the website: it bypasses all security.

## 4. Set up sign-in links

Go to **Authentication → URL Configuration**:

- **Site URL**: your live domain, e.g. `https://klyr.in`. For now you can use `http://localhost:5173`.
- **Redirect URLs**: add both of these:
  - `http://localhost:5173/**`
  - `https://YOUR-DOMAIN/**`

Without these, the links in confirmation and password-reset emails won't return people to your site.

## 5. Emails

Under **Authentication → Providers → Email**:

- **Confirm email** is on by default. New members must click a link before they can log in. We recommend keeping it on.
- Supabase's built-in email sender only allows a few emails per hour. Before launch, connect your own sender under **Authentication → Emails → SMTP Settings**, for example Resend, Brevo or Amazon SES.
- Under **Authentication → Emails → Templates**, you can restyle the confirmation and reset emails to match KLYR.

## 6. Test it

Run `node .claude/serve.js`, then open http://localhost:5173/login.html and:

1. Create an account, then click the link in the confirmation email.
2. Log in. You should land on **Account**, and the menu should show "Account".
3. Log out, then try **Forgot password?**.
4. Join the waitlist, then check **Table Editor → waitlist**.

## How it fits together

| Page | What it does |
|---|---|
| `login.html` | Log in and Sign up tabs, plus Forgot password |
| `account.html` | Shows name, email and join date, with Log out and Change password. Visitors who aren't logged in are sent to Log in. |
| `reset.html` | Where the password-reset email link lands, to choose a new password |
| `waitlist.html` | Saves sign-ups to the `waitlist` table |

"Keep me logged in" keeps people signed in after they close the browser. If it's unticked, they're signed out when they close the tab.
