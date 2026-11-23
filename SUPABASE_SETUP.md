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

---

# Waitlist welcome email

When someone joins the waitlist, a welcome email is sent automatically:

**waitlist table → Database Webhook → Edge Function `waitlist-welcome` → Resend → inbox**

The code is in [`supabase/functions/waitlist-welcome/index.ts`](supabase/functions/waitlist-welcome/index.ts).

## A. Get a Resend API key
1. Sign up at [resend.com](https://resend.com). It's free for up to 3,000 emails a month.
2. Go to **API Keys** → **Create API Key** and copy it (it starts with `re_`). Keep it private.
3. Until you verify your own domain, Resend can only send to **your own email address**. That's fine for testing.

## B. Add the secrets to Supabase
Go to **Edge Functions → Secrets** and add:

| Name | Value |
|---|---|
| `RESEND_API_KEY` | the `re_...` key from Resend |
| `WEBHOOK_SECRET` | any long random text, e.g. from a password generator. You'll paste the same value again in step D. |

## C. Create the function
1. Go to **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Name it exactly `waitlist-welcome`.
3. Delete the sample code, paste everything from `supabase/functions/waitlist-welcome/index.ts`, and click **Deploy**.

## D. Trigger it when someone joins
1. Go to **Database → Webhooks** → **Create a new hook**. Enable webhooks first if asked.
2. Set it up like this:
   - **Name:** `waitlist-welcome`
   - **Table:** `waitlist`
   - **Events:** tick **Insert** only
   - **Type:** **Supabase Edge Functions**, then pick `waitlist-welcome`
   - **HTTP Headers:** add `x-webhook-secret` with the **same value** as `WEBHOOK_SECRET`
3. Click **Create webhook**.

## E. Test
Join the waitlist on the site using your own email, the one you signed up to Resend with. The email should arrive within a minute. If it doesn't, check **Edge Functions → waitlist-welcome → Logs**.

## F. Before launch: send to everyone
1. In Resend, go to **Domains** → **Add domain** (e.g. `klyr.in`) and add the DNS records it shows at your domain provider.
2. Once the domain is verified, add one more secret in Supabase: `EMAIL_FROM` = `KLYR <hello@klyr.in>`.
3. Optional: use the same Resend account as Custom SMTP (see "Emails" above), so account confirmation emails reach everyone too.
