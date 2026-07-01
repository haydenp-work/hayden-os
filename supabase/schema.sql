-- ============================================================
-- HaydenOS  -  Supabase schema (the memory layer)
-- Run this in Supabase Studio > SQL Editor on a fresh project.
-- Single-user build: the app password gate protects everything,
-- and the server uses the service-role key, so RLS is left off.
-- ============================================================

create extension if not exists "pgcrypto";

-- Profile (single row)
create table if not exists profile (
  id        int primary key default 1,
  name      text not null default 'Operator',
  role      text default '',
  org       text default '',
  check (id = 1)
);
insert into profile (id, name, role, org)
  values (1, 'Hayden', 'Regional Product Specialist', 'Hemanext')
  on conflict (id) do nothing;

-- Tasks / CRM
create table if not exists tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  category    text not null default 'Life Admin',
  priority    text not null default 'medium',  -- high | medium | low
  starred     boolean not null default false,
  status      text not null default 'active',  -- active | done
  source      text not null default 'web',     -- web | telegram
  created_at  timestamptz not null default now()
);
create index if not exists tasks_status_idx on tasks (status, priority);

-- Habits and their subtasks
create table if not exists habits (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  position  int not null default 0
);
create table if not exists habit_subtasks (
  id        uuid primary key default gen_random_uuid(),
  habit_id  uuid not null references habits(id) on delete cascade,
  name      text not null,
  position  int not null default 0
);
-- One completion row per subtask per day
create table if not exists habit_log (
  subtask_id uuid not null references habit_subtasks(id) on delete cascade,
  day        date not null,
  done       boolean not null default true,
  primary key (subtask_id, day)
);

-- Meals
create table if not exists meals (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  calories   int not null default 0,
  protein    int not null default 0,
  day        date not null default current_date,
  eaten_at   timestamptz not null default now()
);

-- Journal
create table if not exists journal (
  id         uuid primary key default gen_random_uuid(),
  day        date not null default current_date,
  body       text not null,
  summary    text default '',
  created_at timestamptz not null default now()
);

-- Goals
create table if not exists goals (
  id         uuid primary key default gen_random_uuid(),
  body       text not null,
  scope      text not null default 'week',  -- week | month
  done       boolean not null default false,
  created_at timestamptz not null default now()
);

-- Brain notes, keyed by life category
create table if not exists brain_notes (
  id         uuid primary key default gen_random_uuid(),
  category   text not null,
  body       text not null,
  created_at timestamptz not null default now()
);

-- Finance
create table if not exists finance_accounts (
  id     uuid primary key default gen_random_uuid(),
  name   text not null,
  value  numeric not null default 0
);
create table if not exists finance_history (
  id     uuid primary key default gen_random_uuid(),
  day    date not null default current_date,
  value  numeric not null default 0
);

-- ------------------------------------------------------------
-- Generic starter habits (edit or delete in the app later).
-- Plain inserts, no procedural block, so the SQL editor's
-- "enable RLS" step cannot mangle them.
-- ------------------------------------------------------------
insert into habits (name, position)
select v.name, v.position
from (values
  ('Train', 0),
  ('Supplements', 1),
  ('Deep work block', 2),
  ('Network', 3),
  ('Evening winddown', 4)
) as v(name, position)
where not exists (select 1 from habits);

insert into habit_subtasks (habit_id, name, position)
select h.id, v.name, v.position
from (values
  ('Train', 'Lift', 0),
  ('Train', 'Conditioning', 1),
  ('Supplements', 'Creatine', 0),
  ('Supplements', 'Vitamin D', 1),
  ('Supplements', 'Omega 3', 2),
  ('Supplements', 'Magnesium', 3),
  ('Deep work block', 'Plan the block', 0),
  ('Deep work block', 'Execute', 1),
  ('Network', 'Engage 5 posts', 0),
  ('Network', 'One comment of real value', 1),
  ('Evening winddown', 'Screens off 30 min', 0),
  ('Evening winddown', 'Journal', 1),
  ('Evening winddown', 'Plan tomorrow', 2)
) as v(habit, name, position)
join habits h on h.name = v.habit
where not exists (select 1 from habit_subtasks);

-- ------------------------------------------------------------
-- Spend tracking and integrations (spend + Teams calendar update)
-- ------------------------------------------------------------
create table if not exists app_settings (
  key   text primary key,
  value text
);
insert into app_settings (key, value) values ('spend_limit', '4928')
  on conflict (key) do nothing;

create table if not exists monthly_spend (
  month text primary key,   -- 'YYYY-MM'
  spent numeric not null default 0
);

create table if not exists integrations (
  provider     text primary key,   -- 'microsoft'
  refresh_token text,
  updated_at   timestamptz not null default now()
);

-- Plain weekly schedule (manual entries)
create table if not exists schedule (
  id         uuid primary key default gen_random_uuid(),
  body       text not null,
  position   int not null default 0,
  created_at timestamptz not null default now()
);
