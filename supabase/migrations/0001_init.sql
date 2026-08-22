-- KidSkill Connect — initial schema
-- Invariant: balances are never stored. Every rupee is a row in ledger_entries.

create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- enums

create type user_role          as enum ('parent','trainer','admin');
create type verification_status as enum ('pending','approved','rejected');
create type enquiry_status     as enum ('open','accepted','declined','withdrawn');
create type enrollment_status  as enum ('pending_payment','active','completed','cancelled');
create type session_status     as enum ('scheduled','attended','no_show','cancelled');
create type account_type       as enum ('parent_wallet','escrow','trainer_earnings','platform_revenue');
create type ledger_type        as enum ('topup','hold','release','commission','refund','payout');
create type notify_channel     as enum ('whatsapp','sms','in_app');
create type notify_status      as enum ('queued','sent','failed');

-- ---------------------------------------------------------------- identity

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        user_role not null,
  full_name   text not null,
  phone       text unique,
  avatar_url  text,
  location    extensions.geography(point, 4326),
  area_label  text,
  created_at  timestamptz not null default now()
);

create table public.children (
  id         uuid primary key default extensions.gen_random_uuid(),
  parent_id  uuid not null references public.profiles(id) on delete cascade,
  name       text not null,
  dob        date,
  interests  text[] not null default '{}',
  notes      text,
  created_at timestamptz not null default now()
);
create index children_parent_idx on public.children(parent_id);

create table public.categories (
  id         uuid primary key default extensions.gen_random_uuid(),
  slug       text unique not null,
  name       text not null,
  group_name text not null   -- sports | music | arts | academics | life_skills
);

create table public.trainer_profiles (
  user_id           uuid primary key references public.profiles(id) on delete cascade,
  headline          text not null,
  bio               text,
  years_experience  integer not null default 0,
  base_location     extensions.geography(point, 4326) not null,
  service_radius_km integer not null default 10 check (service_radius_km between 1 and 50),
  id_verified       boolean not null default false,
  created_at        timestamptz not null default now()
);
create index trainer_base_location_idx on public.trainer_profiles using gist (base_location);

-- Barrier to entry. A trainer is visible only where status = 'approved'.
-- Rate lives here, not on the trainer — a coach may price categories differently.
create table public.trainer_categories (
  id             uuid primary key default extensions.gen_random_uuid(),
  trainer_id     uuid not null references public.trainer_profiles(user_id) on delete cascade,
  category_id    uuid not null references public.categories(id),
  rate_per_class numeric(12,2) not null check (rate_per_class > 0),
  credential_url text,
  credential_note text,
  status         verification_status not null default 'pending',
  reviewed_by    uuid references public.profiles(id),
  reviewed_at    timestamptz,
  reject_reason  text,
  created_at     timestamptz not null default now(),
  unique (trainer_id, category_id)
);
create index trainer_categories_lookup_idx on public.trainer_categories(category_id, status);

-- ---------------------------------------------------------------- matching

create table public.enquiries (
  id           uuid primary key default extensions.gen_random_uuid(),
  parent_id    uuid not null references public.profiles(id) on delete cascade,
  child_id     uuid not null references public.children(id) on delete cascade,
  trainer_id   uuid not null references public.trainer_profiles(user_id) on delete cascade,
  category_id  uuid not null references public.categories(id),
  message      text,
  status       enquiry_status not null default 'open',
  responded_at timestamptz,
  created_at   timestamptz not null default now()
);
create index enquiries_trainer_idx on public.enquiries(trainer_id, status);
create index enquiries_parent_idx  on public.enquiries(parent_id, status);

create table public.enrollments (
  id                uuid primary key default extensions.gen_random_uuid(),
  enquiry_id        uuid references public.enquiries(id),
  parent_id         uuid not null references public.profiles(id),
  child_id          uuid not null references public.children(id),
  trainer_id        uuid not null references public.trainer_profiles(user_id),
  category_id       uuid not null references public.categories(id),
  rate_per_class    numeric(12,2) not null check (rate_per_class > 0),
  classes_per_month integer not null default 8 check (classes_per_month between 1 and 31),
  commission_pct    numeric(5,2) not null default 15.00 check (commission_pct between 0 and 50),
  status            enrollment_status not null default 'pending_payment',
  start_date        date,
  created_at        timestamptz not null default now()
);
create index enrollments_parent_idx  on public.enrollments(parent_id, status);
create index enrollments_trainer_idx on public.enrollments(trainer_id, status);

create table public.sessions (
  id                   uuid primary key default extensions.gen_random_uuid(),
  enrollment_id        uuid not null references public.enrollments(id) on delete cascade,
  scheduled_at         timestamptz not null,
  status               session_status not null default 'scheduled',
  attendance_marked_at timestamptz,
  assessment_note      text,
  skill_rating         integer check (skill_rating between 1 and 5),
  focus_areas          text[] not null default '{}',
  created_at           timestamptz not null default now()
);
create index sessions_enrollment_idx on public.sessions(enrollment_id, scheduled_at);
create index sessions_today_idx      on public.sessions(scheduled_at) where status = 'scheduled';

-- ---------------------------------------------------------------- money

create table public.accounts (
  id         uuid primary key default extensions.gen_random_uuid(),
  owner_id   uuid references public.profiles(id) on delete cascade,
  type       account_type not null,
  created_at timestamptz not null default now()
);
create unique index accounts_owner_type_uq on public.accounts(owner_id, type) where owner_id is not null;
create unique index accounts_platform_uq   on public.accounts(type)           where owner_id is null;

-- The single source of financial truth. Append only — never update or delete a row.
create table public.ledger_entries (
  id            uuid primary key default extensions.gen_random_uuid(),
  enrollment_id uuid references public.enrollments(id),
  session_id    uuid references public.sessions(id),
  from_account  uuid references public.accounts(id),   -- null = external (gateway)
  to_account    uuid references public.accounts(id),   -- null = external (payout)
  amount        numeric(12,2) not null check (amount > 0),
  type          ledger_type not null,
  memo          text,
  created_at    timestamptz not null default now(),
  check (from_account is not null or to_account is not null)
);
create index ledger_session_idx    on public.ledger_entries(session_id);
create index ledger_enrollment_idx on public.ledger_entries(enrollment_id);
create index ledger_from_idx       on public.ledger_entries(from_account);
create index ledger_to_idx         on public.ledger_entries(to_account);

create view public.account_balances as
select
  a.id       as account_id,
  a.owner_id,
  a.type,
  coalesce((select sum(l.amount) from public.ledger_entries l where l.to_account   = a.id), 0)
- coalesce((select sum(l.amount) from public.ledger_entries l where l.from_account = a.id), 0) as balance
from public.accounts a;

create view public.enrollment_progress as
select
  e.id as enrollment_id,
  e.classes_per_month,
  count(distinct l.session_id) filter (where l.type = 'release') as classes_delivered,
  e.classes_per_month - count(distinct l.session_id) filter (where l.type = 'release') as classes_remaining
from public.enrollments e
left join public.ledger_entries l on l.enrollment_id = e.id
group by e.id;

-- ---------------------------------------------------------------- feedback + notifications

create table public.feedback (
  id         uuid primary key default extensions.gen_random_uuid(),
  session_id uuid references public.sessions(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  audience   user_role not null,
  rating     integer not null check (rating between 1 and 5),
  comment    text,
  created_at timestamptz not null default now(),
  unique (session_id, author_id)
);

create table public.notifications (
  id           uuid primary key default extensions.gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  channel      notify_channel not null default 'in_app',
  template     text not null,
  payload      jsonb not null default '{}',
  status       notify_status not null default 'queued',
  sent_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications(recipient_id, created_at desc);

-- ---------------------------------------------------------------- triggers

-- Every profile gets its accounts automatically.
create or replace function public.bootstrap_accounts()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'parent' then
    insert into public.accounts (owner_id, type)
    values (new.id, 'parent_wallet'), (new.id, 'escrow')
    on conflict do nothing;
  elsif new.role = 'trainer' then
    insert into public.accounts (owner_id, type)
    values (new.id, 'trainer_earnings')
    on conflict do nothing;
  end if;
  return new;
end $$;

create trigger trg_bootstrap_accounts
after insert on public.profiles
for each row execute function public.bootstrap_accounts();

-- THE core rule: money moves only when a learning artifact exists.
-- Fires before update of sessions.status. Idempotent — re-running never double-pays.
create or replace function public.release_session_funds()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_enr        public.enrollments%rowtype;
  v_escrow     uuid;
  v_trainer    uuid;
  v_platform   uuid;
  v_commission numeric(12,2);
  v_net        numeric(12,2);
begin
  if new.status is distinct from 'attended' then return new; end if;
  if old.status = 'attended' then return new; end if;

  if new.assessment_note is null or char_length(btrim(new.assessment_note)) < 10 then
    raise exception 'An assessment note of at least 10 characters is required before marking a class attended';
  end if;
  if new.skill_rating is null then
    raise exception 'A skill rating is required before marking a class attended';
  end if;

  select * into v_enr from public.enrollments where id = new.enrollment_id;
  if not found then raise exception 'Enrollment % not found', new.enrollment_id; end if;
  if v_enr.status <> 'active' then
    raise exception 'Enrollment % is not active', v_enr.id;
  end if;

  if exists (select 1 from public.ledger_entries where session_id = new.id and type = 'release') then
    return new;
  end if;

  select id into v_escrow   from public.accounts where owner_id = v_enr.parent_id  and type = 'escrow';
  select id into v_trainer  from public.accounts where owner_id = v_enr.trainer_id and type = 'trainer_earnings';
  select id into v_platform from public.accounts where owner_id is null            and type = 'platform_revenue';

  v_commission := round(v_enr.rate_per_class * v_enr.commission_pct / 100.0, 2);
  v_net        := v_enr.rate_per_class - v_commission;

  insert into public.ledger_entries (enrollment_id, session_id, from_account, to_account, amount, type, memo)
  values
    (v_enr.id, new.id, v_escrow, v_trainer,  v_net,        'release',    'Class verified with assessment'),
    (v_enr.id, new.id, v_escrow, v_platform, v_commission, 'commission', 'Platform commission');

  new.attendance_marked_at := now();
  return new;
end $$;

create trigger trg_release_session_funds
before update of status on public.sessions
for each row execute function public.release_session_funds();

-- ---------------------------------------------------------------- rpcs

-- Called after the (mock) gateway succeeds. Tops up the wallet and holds it in escrow.
create or replace function public.fund_enrollment(p_enrollment_id uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  v_enr    public.enrollments%rowtype;
  v_wallet uuid;
  v_escrow uuid;
  v_total  numeric(12,2);
  i        integer;
begin
  select * into v_enr from public.enrollments where id = p_enrollment_id for update;
  if not found then raise exception 'Enrollment not found'; end if;
  if v_enr.status <> 'pending_payment' then
    raise exception 'Enrollment % is not awaiting payment', v_enr.id;
  end if;

  v_total := v_enr.rate_per_class * v_enr.classes_per_month;

  select id into v_wallet from public.accounts where owner_id = v_enr.parent_id and type = 'parent_wallet';
  select id into v_escrow from public.accounts where owner_id = v_enr.parent_id and type = 'escrow';

  insert into public.ledger_entries (enrollment_id, from_account, to_account, amount, type, memo)
  values
    (v_enr.id, null,     v_wallet, v_total, 'topup', 'Gateway payment received'),
    (v_enr.id, v_wallet, v_escrow, v_total, 'hold',  'Monthly commitment held in escrow');

  update public.enrollments
     set status = 'active',
         start_date = coalesce(start_date, current_date)
   where id = v_enr.id;

  -- Generate the month's classes, weekly from the start date.
  for i in 0 .. (v_enr.classes_per_month - 1) loop
    insert into public.sessions (enrollment_id, scheduled_at)
    values (v_enr.id, (current_date + (i * 7)) + time '17:00');
  end loop;

  return v_total;
end $$;

-- Location-aware search. Respects the trainer's own service radius as well as
-- the parent's slider, and only ever returns approved categories.
create or replace function public.search_trainers(
  p_lat         double precision,
  p_lng         double precision,
  p_category_id uuid    default null,
  p_radius_km   integer default 10,
  p_max_rate    numeric default null
)
returns table (
  trainer_id       uuid,
  full_name        text,
  headline         text,
  avatar_url       text,
  area_label       text,
  category_id      uuid,
  category_name    text,
  rate_per_class   numeric,
  years_experience integer,
  id_verified      boolean,
  distance_km      numeric
)
language sql stable set search_path = public, extensions as $$
  select
    p.id, p.full_name, tp.headline, p.avatar_url, p.area_label,
    c.id, c.name, tc.rate_per_class, tp.years_experience, tp.id_verified,
    round((ST_Distance(tp.base_location,
           ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) / 1000)::numeric, 1)
  from public.trainer_categories tc
  join public.trainer_profiles  tp on tp.user_id = tc.trainer_id
  join public.profiles          p  on p.id       = tc.trainer_id
  join public.categories        c  on c.id       = tc.category_id
  where tc.status = 'approved'
    and (p_category_id is null or tc.category_id = p_category_id)
    and (p_max_rate   is null or tc.rate_per_class <= p_max_rate)
    and ST_DWithin(
          tp.base_location,
          ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
          least(p_radius_km, tp.service_radius_km) * 1000)
  order by ST_Distance(tp.base_location,
           ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) asc;
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Admin oversight: every accepted service currently running, with live money state.
-- Escrow held is derived per enrollment, not read off an account balance, because one
-- parent's escrow account may back several enrollments at once.
create or replace function public.admin_active_services(
  p_status enrollment_status default 'active'
)
returns table (
  enrollment_id      uuid,
  child_name         text,
  parent_name        text,
  parent_phone       text,
  trainer_name       text,
  trainer_phone      text,
  category_name      text,
  area_label         text,
  status             enrollment_status,
  start_date         date,
  rate_per_class     numeric,
  classes_per_month  integer,
  classes_delivered  bigint,
  classes_remaining  bigint,
  committed_amount   numeric,
  still_in_escrow    numeric,
  released_to_trainer numeric,
  platform_earned    numeric,
  last_class_at      timestamptz,
  next_class_at      timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Admin role required';
  end if;

  return query
  select
    e.id,
    ch.name,
    pp.full_name,
    pp.phone,
    tt.full_name,
    tt.phone,
    c.name,
    tt.area_label,
    e.status,
    e.start_date,
    e.rate_per_class,
    e.classes_per_month,
    coalesce(prog.classes_delivered, 0),
    coalesce(prog.classes_remaining, e.classes_per_month::bigint),
    (e.rate_per_class * e.classes_per_month)::numeric,
      coalesce((select sum(l.amount) from public.ledger_entries l
                 where l.enrollment_id = e.id and l.type = 'hold'), 0)
    - coalesce((select sum(l.amount) from public.ledger_entries l
                 where l.enrollment_id = e.id
                   and l.type in ('release','commission','refund')), 0),
    coalesce((select sum(l.amount) from public.ledger_entries l
               where l.enrollment_id = e.id and l.type = 'release'), 0),
    coalesce((select sum(l.amount) from public.ledger_entries l
               where l.enrollment_id = e.id and l.type = 'commission'), 0),
    (select max(s.attendance_marked_at) from public.sessions s
      where s.enrollment_id = e.id),
    (select min(s.scheduled_at) from public.sessions s
      where s.enrollment_id = e.id and s.status = 'scheduled' and s.scheduled_at > now())
  from public.enrollments e
  join public.children          ch   on ch.id      = e.child_id
  join public.profiles          pp   on pp.id      = e.parent_id
  join public.profiles          tt   on tt.id      = e.trainer_id
  join public.categories        c    on c.id       = e.category_id
  left join public.enrollment_progress prog on prog.enrollment_id = e.id
  where p_status is null or e.status = p_status
  order by e.start_date desc nulls last, e.created_at desc;
end $$;

-- ---------------------------------------------------------------- rls

alter table public.profiles           enable row level security;
alter table public.children           enable row level security;
alter table public.trainer_profiles   enable row level security;
alter table public.trainer_categories enable row level security;
alter table public.enquiries          enable row level security;
alter table public.enrollments        enable row level security;
alter table public.sessions           enable row level security;
alter table public.accounts           enable row level security;
alter table public.ledger_entries     enable row level security;
alter table public.feedback           enable row level security;
alter table public.notifications      enable row level security;
alter table public.categories         enable row level security;

create policy categories_read on public.categories for select using (true);

create policy profiles_self  on public.profiles for all
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid());
create policy profiles_read  on public.profiles for select using (true);

create policy children_owner on public.children for all
  using (parent_id = auth.uid() or public.is_admin()) with check (parent_id = auth.uid());

create policy trainer_profiles_read on public.trainer_profiles for select using (true);
create policy trainer_profiles_own  on public.trainer_profiles for all
  using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid());

create policy trainer_categories_read on public.trainer_categories for select
  using (status = 'approved' or trainer_id = auth.uid() or public.is_admin());
create policy trainer_categories_own  on public.trainer_categories for insert
  with check (trainer_id = auth.uid());
create policy trainer_categories_admin on public.trainer_categories for update
  using (public.is_admin());

create policy enquiries_parties on public.enquiries for all
  using (parent_id = auth.uid() or trainer_id = auth.uid() or public.is_admin())
  with check (parent_id = auth.uid() or trainer_id = auth.uid());

create policy enrollments_parties on public.enrollments for select
  using (parent_id = auth.uid() or trainer_id = auth.uid() or public.is_admin());

create policy sessions_parties on public.sessions for select using (
  exists (select 1 from public.enrollments e where e.id = enrollment_id
          and (e.parent_id = auth.uid() or e.trainer_id = auth.uid()))
  or public.is_admin());
create policy sessions_trainer_update on public.sessions for update using (
  exists (select 1 from public.enrollments e where e.id = enrollment_id
          and e.trainer_id = auth.uid()));

create policy accounts_owner on public.accounts for select
  using (owner_id = auth.uid() or public.is_admin());

-- Ledger is readable by the parties to the enrollment; writable only by triggers
-- and security-definer functions. No client-side insert policy, by design.
create policy ledger_parties on public.ledger_entries for select using (
  exists (select 1 from public.enrollments e where e.id = enrollment_id
          and (e.parent_id = auth.uid() or e.trainer_id = auth.uid()))
  or public.is_admin());

create policy feedback_parties on public.feedback for all
  using (author_id = auth.uid() or public.is_admin()) with check (author_id = auth.uid());

create policy notifications_own on public.notifications for select
  using (recipient_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------- seed

insert into public.accounts (owner_id, type) values (null, 'platform_revenue');

insert into public.categories (slug, name, group_name) values
  ('carnatic-vocal',   'Carnatic vocal',    'music'),
  ('hindustani-vocal', 'Hindustani vocal',  'music'),
  ('western-guitar',   'Western guitar',    'music'),
  ('keyboard-piano',   'Keyboard & piano',  'music'),
  ('bharatanatyam',    'Bharatanatyam',     'dance'),
  ('hip-hop-dance',    'Hip-hop dance',     'dance'),
  ('swimming',         'Swimming',          'sports'),
  ('football',         'Football',          'sports'),
  ('cricket',          'Cricket',           'sports'),
  ('badminton',        'Badminton',         'sports'),
  ('chess',            'Chess',             'life_skills'),
  ('sketching',        'Sketching',         'arts');
