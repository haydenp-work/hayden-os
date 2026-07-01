-- Run this once in Supabase SQL Editor to add the spend tracker
-- and the plain weekly schedule to your existing database.

create table if not exists app_settings (key text primary key, value text);
insert into app_settings (key, value) values ('spend_limit', '4928')
  on conflict (key) do nothing;

create table if not exists monthly_spend (
  month text primary key,   -- 'YYYY-MM'
  spent numeric not null default 0
);

create table if not exists schedule (
  id         uuid primary key default gen_random_uuid(),
  body       text not null,
  position   int not null default 0,
  created_at timestamptz not null default now()
);
