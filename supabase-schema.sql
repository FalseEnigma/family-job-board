-- ScoreChore - Full Supabase Schema (from scratch)
-- Run this in Supabase SQL Editor after creating a new project.

-- =============================================================================
-- 1. TABLES
-- =============================================================================

-- Households (families)
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  board_code text unique,
  parent_pin text,
  created_at timestamptz not null default now()
);

-- Kids
create table if not exists public.kids (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  age int,
  color text,
  points_balance int not null default 0,
  points_lifetime int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Job templates (recurring jobs)
create table if not exists public.job_templates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  description text,
  base_points int not null default 10,
  requires_approval boolean not null default true,
  min_age int,
  frequency_days int not null default 2,
  is_active boolean not null default true,
  last_generated_at timestamptz,
  created_at timestamptz not null default now()
);

-- Jobs (one-time or from template)
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  template_id uuid references public.job_templates(id) on delete set null,
  name text not null,
  description text,
  base_points int not null default 10,
  requires_approval boolean not null default true,
  min_age int,
  is_active boolean not null default true,
  is_claimed boolean not null default false,
  claimed_by_kid_id uuid references public.kids(id) on delete set null,
  created_at timestamptz not null default now()
);

-- App settings per household
create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null unique references public.households(id) on delete cascade,
  show_rewards_on_board boolean not null default true,
  created_at timestamptz not null default now()
);

-- Rewards catalog
create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  description text,
  cost_points int not null default 10,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Block certain kids from certain jobs
create table if not exists public.job_blocked_kids (
  job_id uuid not null references public.jobs(id) on delete cascade,
  kid_id uuid not null references public.kids(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  primary key (job_id, kid_id)
);

-- Job completion logs
create table if not exists public.job_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  kid_id uuid not null references public.kids(id) on delete cascade,
  status text not null check (status in ('COMPLETED', 'APPROVED', 'REJECTED')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  approved_at timestamptz,
  points_awarded int
);

-- Job requests (kid asks for more work)
create table if not exists public.job_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  kid_id uuid references public.kids(id) on delete set null,
  message text,
  handled boolean not null default false,
  created_at timestamptz not null default now()
);

-- Reward requests
create table if not exists public.reward_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  kid_id uuid not null references public.kids(id) on delete cascade,
  reward_id uuid not null references public.rewards(id) on delete cascade,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  note text,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

-- Point transactions (spend/penalty history)
create table if not exists public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  kid_id uuid not null references public.kids(id) on delete cascade,
  type text not null check (type in ('SPEND', 'PENALTY')),
  amount int not null,
  description text not null,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- 2. INDEXES (for common queries)
-- =============================================================================

create index if not exists idx_kids_household on public.kids(household_id);
create index if not exists idx_jobs_household on public.jobs(household_id);
create index if not exists idx_job_templates_household on public.job_templates(household_id);
create index if not exists idx_job_logs_household on public.job_logs(household_id);
create index if not exists idx_job_requests_household on public.job_requests(household_id);
create index if not exists idx_reward_requests_household on public.reward_requests(household_id);
create index if not exists idx_point_transactions_household on public.point_transactions(household_id);
create index if not exists idx_households_board_code on public.households(board_code) where board_code is not null;

-- =============================================================================
-- 3. RPC: generate_due_jobs (creates jobs from recurring templates)
-- =============================================================================

create or replace function public.generate_due_jobs()
returns void
language plpgsql
security definer
as $$
declare
  t record;
  now_ts timestamptz := now();
  active_job_count int;
begin
  for t in
    select jt.*
    from public.job_templates jt
    where jt.is_active = true
  loop
    -- Skip if there's already an active job from this template
    select count(*) into active_job_count
    from public.jobs j
    where j.template_id = t.id
      and j.is_active = true
      and j.household_id = t.household_id;

    if active_job_count > 0 then
      continue;
    end if;

    -- Skip if not due yet (last_generated_at + frequency_days > now)
    if t.last_generated_at is not null then
      if t.last_generated_at + (t.frequency_days || ' days')::interval > now_ts then
        continue;
      end if;
    end if;

    -- Insert new job from template
    insert into public.jobs (
      household_id, template_id, name, description,
      base_points, requires_approval, min_age,
      is_active, is_claimed, claimed_by_kid_id
    ) values (
      t.household_id, t.id, t.name, t.description,
      t.base_points, t.requires_approval, t.min_age,
      true, false, null
    );

    -- Update last_generated_at
    update public.job_templates
    set last_generated_at = now_ts
    where id = t.id;
  end loop;
end;
$$;

-- =============================================================================
-- 4. RLS POLICIES (allow anon key - no auth in this app)
-- =============================================================================

alter table public.households enable row level security;
alter table public.kids enable row level security;
alter table public.job_templates enable row level security;
alter table public.jobs enable row level security;
alter table public.app_settings enable row level security;
alter table public.rewards enable row level security;
alter table public.job_blocked_kids enable row level security;
alter table public.job_logs enable row level security;
alter table public.job_requests enable row level security;
alter table public.reward_requests enable row level security;
alter table public.point_transactions enable row level security;

-- Allow all operations for anon (family app with no auth)
create policy "anon all households" on public.households for all using (true) with check (true);
create policy "anon all kids" on public.kids for all using (true) with check (true);
create policy "anon all job_templates" on public.job_templates for all using (true) with check (true);
create policy "anon all jobs" on public.jobs for all using (true) with check (true);
create policy "anon all app_settings" on public.app_settings for all using (true) with check (true);
create policy "anon all rewards" on public.rewards for all using (true) with check (true);
create policy "anon all job_blocked_kids" on public.job_blocked_kids for all using (true) with check (true);
create policy "anon all job_logs" on public.job_logs for all using (true) with check (true);
create policy "anon all job_requests" on public.job_requests for all using (true) with check (true);
create policy "anon all reward_requests" on public.reward_requests for all using (true) with check (true);
create policy "anon all point_transactions" on public.point_transactions for all using (true) with check (true);

-- Allow anon to execute generate_due_jobs
grant execute on function public.generate_due_jobs() to anon;

-- =============================================================================
-- 5. SEED: Default household (matches DEFAULT_HOUSEHOLD_ID in app)
-- =============================================================================

insert into public.households (id, name, board_code)
values (
  '7591ea9c-90f5-4d7f-9da2-aee44dd58039'::uuid,
  'Default Family',
  null
)
on conflict do nothing;

insert into public.app_settings (household_id, show_rewards_on_board)
values ('7591ea9c-90f5-4d7f-9da2-aee44dd58039'::uuid, true)
on conflict (household_id) do nothing;
