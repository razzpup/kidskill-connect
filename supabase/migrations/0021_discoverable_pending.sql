-- KidsConnect — DEMO-ONLY relaxation of invariant #5 ("only approved categories are
-- searchable"). For now, a coach is discoverable the moment they submit a category
-- application, not once an admin approves it — admin approval still exists and still
-- changes status for real, it just isn't the search gate anymore. This is deliberate
-- and temporary; to restore the real rule, put `tc.status = 'approved'` back in both
-- search_trainers and trainerDetail's category filter (lib/db/parent.ts) and revert
-- this migration's comment in CLAUDE.md.
--
-- A rejected application still does not surface — "nobody has looked at this yet" and
-- "somebody looked and said no" are different things.

-- The return type gained a column, so replace won't do — the old signature has to go.
drop function if exists public.search_trainers(double precision, double precision, uuid, integer, numeric, class_mode);

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
  distance_km      numeric,
  category_status  verification_status
)
language sql stable set search_path = public, extensions as $fn$
  select
    p.id, p.full_name, tp.headline, p.avatar_url, p.area_label,
    c.id, c.name, tc.rate_per_class, tp.years_experience, tp.id_verified,
    tp.teaches_online, tp.teaches_in_person,
    round((ST_Distance(tp.base_location,
           ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) / 1000)::numeric, 1),
    tc.status
  from public.trainer_categories tc
  join public.trainer_profiles  tp on tp.user_id = tc.trainer_id
  join public.profiles          p  on p.id       = tc.trainer_id
  join public.categories        c  on c.id       = tc.category_id
  where tc.status in ('approved', 'pending')
    and (p_category_id is null or tc.category_id = p_category_id)
    and (p_max_rate   is null or tc.rate_per_class <= p_max_rate)
    and (p_mode = 'either'
         or (p_mode = 'online'    and tp.teaches_online)
         or (p_mode = 'in_person' and tp.teaches_in_person))
    and (p_mode = 'online'
         or ST_DWithin(
              tp.base_location,
              ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
              least(p_radius_km, tp.service_radius_km) * 1000))
  order by
    case when p_mode = 'online' then tp.years_experience end desc nulls last,
    ST_Distance(tp.base_location,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) asc;
$fn$;

grant execute on function
  public.search_trainers(double precision, double precision, uuid, integer, numeric, class_mode)
  to authenticated;
