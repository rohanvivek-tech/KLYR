-- =========================================================
-- KLYR — "Ask us anything" contact form
--   website form → contact_messages row (RLS: insert-only)
--   → database trigger → Edge Function `contact-notify`
--   → email to the owner + automatic reply to the sender (Gmail SMTP)
-- Safe to run again.
-- =========================================================

create extension if not exists pg_net with schema extensions;

create table if not exists public.contact_messages (
  id          bigint generated always as identity primary key,
  name        text not null check (char_length(name) between 1 and 120),
  email       text not null check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  message     text not null check (char_length(message) between 1 and 2000),
  created_at  timestamptz not null default now()
);

-- Row Level Security: visitors can only ADD a message. Nobody can read,
-- change or delete messages with the website's public key.
alter table public.contact_messages enable row level security;

drop policy if exists "Anyone can send a message" on public.contact_messages;
create policy "Anyone can send a message"
  on public.contact_messages
  for insert
  to anon, authenticated
  with check (true);

grant usage on schema public to anon, authenticated;
grant insert on public.contact_messages to anon, authenticated;

-- Webhook: after each new message, call the Edge Function.
-- The shared secret lives in Supabase Vault (name: contact_webhook_secret),
-- never in this file.
create or replace function public.notify_contact_message()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  hook_secret text;
begin
  select decrypted_secret into hook_secret
  from vault.decrypted_secrets
  where name = 'contact_webhook_secret'
  limit 1;

  if hook_secret is null then
    raise warning 'contact_webhook_secret is missing from Vault; no email sent';
    return new;
  end if;

  perform net.http_post(
    url     := 'https://fhejghohljontqpidrrh.supabase.co/functions/v1/contact-notify',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', hook_secret),
    body    := jsonb_build_object('type', 'INSERT', 'table', 'contact_messages', 'record', to_jsonb(new))
  );
  return new;
end;
$$;

revoke all on function public.notify_contact_message() from public, anon, authenticated;

drop trigger if exists on_contact_message on public.contact_messages;
create trigger on_contact_message
  after insert on public.contact_messages
  for each row execute function public.notify_contact_message();

notify pgrst, 'reload schema';
