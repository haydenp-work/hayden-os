-- HaydenOS v2: schedule calendar, weekly/daily tasks, protein goal.
-- Safe to run on your existing database. Older unused tables are left alone.

create table if not exists events (
  id         uuid primary key default gen_random_uuid(),
  day        date not null,
  start_min  int not null default 540,   -- minutes from midnight (540 = 9:00)
  end_min    int not null default 600,
  title      text not null,
  created_at timestamptz not null default now()
);

create table if not exists weekly_tasks (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  done       boolean not null default false,
  pinned     boolean not null default false,   -- pinned into Today
  created_at timestamptz not null default now()
);

create table if not exists daily_tasks (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  day        date not null,
  done       boolean not null default false,
  created_at timestamptz not null default now()
);

-- spend + settings (in case not already present)
create table if not exists app_settings (key text primary key, value text);
insert into app_settings (key, value) values ('spend_limit', '4928') on conflict (key) do nothing;
insert into app_settings (key, value) values ('protein_goal', '200') on conflict (key) do nothing;
create table if not exists monthly_spend (month text primary key, spent numeric not null default 0);

-- goals, meals, journal, profile are unchanged and reused

-- Recurring daily reminders (e.g. every Thursday)
create table if not exists recurring_tasks (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  weekday    int not null,          -- 0=Sunday ... 6=Saturday (JS getDay)
  last_run   date,                  -- last date it was materialized into daily_tasks
  created_at timestamptz not null default now()
);
