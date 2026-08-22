-- KidSkill Connect — online or in person, and what a child is actually into.
--
-- A parent picking "online" is only meaningful if trainers declare what they offer and
-- search honours it. So this adds both sides of that, and one consequence worth being
-- explicit about: for an online class, distance is irrelevant. A parent searching online
-- lessons should see the best teacher, not the nearest one, so the radius constraint is
-- dropped for online results rather than merely widened.

do $do$
begin
  if not exists (select 1 from pg_type where typname = 'class_mode') then
    create type class_mode as enum ('online','in_person','either');
  end if;
end $do$;

-- What a trainer offers. In-person is the default because that is what the seed and the
-- existing radius logic already assume.
alter table public.trainer_profiles
  add column if not exists teaches_online    boolean not null default false,
  add column if not exists teaches_in_person boolean not null default true;

-- What a child needs. Per child, not per parent — a six-year-old may need someone in the
-- room while their older sibling is fine on a screen.
alter table public.children
  add column if not exists preferred_mode class_mode not null default 'either';

comment on column public.children.interests is
  'Free-text focus areas the parent picked at onboarding, used to suggest categories.';

-- ---------------------------------------------------------------- search

-- Adds p_mode. Everything else behaves as before, including the two-way radius rule.
drop function if exists public.search_trainers(double precision, double precision, uuid, integer, numeric);

create or replace function public.search_trainers(
  p_lat         double precision,
  p_lng         double precision,
  p_category_id uuid       default null,
  p_radius_km   integer    default 10,
  p_max_rate    numeric    default null,
  p_mode        class_mode default 'either'
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
  teaches_online   boolean,
  teaches_in_person boolean,
  distance_km      numeric
)
language sql stable set search_path = public, extensions as $fn$
  select
    p.id, p.full_name, tp.headline, p.avatar_url, p.area_label,
    c.id, c.name, tc.rate_per_class, tp.years_experience, tp.id_verified,
    tp.teaches_online, tp.teaches_in_person,
    round((ST_Distance(tp.base_location,
           ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) / 1000)::numeric, 1)
  from public.trainer_categories tc
  join public.trainer_profiles  tp on tp.user_id = tc.trainer_id
  join public.profiles          p  on p.id       = tc.trainer_id
  join public.categories        c  on c.id       = tc.category_id
  where tc.status = 'approved'
    and (p_category_id is null or tc.category_id = p_category_id)
    and (p_max_rate   is null or tc.rate_per_class <= p_max_rate)
    -- Offers what was asked for.
    and (p_mode = 'either'
         or (p_mode = 'online'    and tp.teaches_online)
         or (p_mode = 'in_person' and tp.teaches_in_person))
    -- Distance only constrains someone who has to travel. An online-only search is not
    -- a local search, so the radius is not applied to it.
    and (p_mode = 'online'
         or ST_DWithin(
              tp.base_location,
              ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
              least(p_radius_km, tp.service_radius_km) * 1000))
  order by
    -- For online, the nearest trainer is not the most relevant one.
    case when p_mode = 'online' then tp.years_experience end desc nulls last,
    ST_Distance(tp.base_location,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) asc;
$fn$;

grant execute on function
  public.search_trainers(double precision, double precision, uuid, integer, numeric, class_mode)
  to authenticated;
