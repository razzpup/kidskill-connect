-- KidsConnect — booking moves from "one recurring weekly hour, ×4 for the month" to
-- picking actual calendar dates. classes_per_month is now just how many dates were
-- picked — no multiplier, no assumption that a class repeats weekly at all.
--
-- This also fixes a real bug in the previous slot-availability work: trainerBookedSlots
-- read straight off `enrollments`, whose RLS policy (enrollments_parties) only lets the
-- parent or trainer ON that enrollment see it. A parent evaluating a coach they've never
-- booked with got zero rows back and every slot looked free, whether it was or not.
-- trainer_busy_instants is security definer specifically so a stranger-parent can see
-- what's actually taken before they pick a date.

-- ---------------------------------------------------------------- read: what's busy

create or replace function public.trainer_busy_instants(
  p_trainer_id uuid,
  p_from       timestamptz,
  p_to         timestamptz
) returns table (scheduled_at timestamptz)
language sql stable security definer set search_path = public as $fn$
  select s.scheduled_at
    from public.sessions s
    join public.enrollments e on e.id = s.enrollment_id
   where e.trainer_id = p_trainer_id
     and s.status <> 'cancelled'
     and s.scheduled_at >= p_from
     and s.scheduled_at <  p_to
$fn$;

grant execute on function
  public.trainer_busy_instants(uuid, timestamptz, timestamptz)
  to authenticated;

-- ---------------------------------------------------------------- write: book them

drop function if exists public.book_slot(uuid, uuid, uuid, smallint[], time[]);

create or replace function public.book_slots(
  p_child_id    uuid,
  p_trainer_id  uuid,
  p_category_id uuid,
  p_timestamps  timestamptz[]
) returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  v_rate    numeric(12,2);
  v_enr     uuid;
  v_count   integer := coalesce(array_length(p_timestamps, 1), 0);
  v_ts      timestamptz;
  v_weekday smallint;
  v_time    time;
  i         integer;
begin
  if v_count = 0 then
    raise exception 'Pick at least one class';
  end if;

  if not exists (select 1 from public.children where id = p_child_id and parent_id = auth.uid()) then
    raise exception 'That is not your child';
  end if;

  select rate_per_class into v_rate
    from public.trainer_categories
   where trainer_id = p_trainer_id and category_id = p_category_id and status = 'approved';
  if v_rate is null then
    raise exception 'This coach is not approved in that category';
  end if;

  for i in 1 .. v_count loop
    v_ts := p_timestamps[i];
    if v_ts <= now() then
      raise exception 'Pick a class time in the future';
    end if;
    v_weekday := extract(dow  from (v_ts at time zone 'Asia/Kolkata'))::smallint;
    v_time    := (v_ts at time zone 'Asia/Kolkata')::time;

    if exists (
      select 1 from public.sessions s
      join public.enrollments e on e.id = s.enrollment_id
      where e.trainer_id = p_trainer_id and s.status <> 'cancelled' and s.scheduled_at = v_ts
    ) then
      raise exception 'One of those classes is already taken — pick another time';
    end if;
    if exists (
      select 1 from public.trainer_blocked_slots
       where trainer_id = p_trainer_id and weekday = v_weekday and time = v_time
    ) then
      raise exception 'The coach has marked one of those times as unavailable';
    end if;
  end loop;

  insert into public.enrollments
    (parent_id, child_id, trainer_id, category_id, rate_per_class,
     classes_per_month, schedule_weekday, schedule_time)
  values
    (auth.uid(), p_child_id, p_trainer_id, p_category_id, v_rate, v_count,
     extract(dow from (p_timestamps[1] at time zone 'Asia/Kolkata'))::smallint,
     (p_timestamps[1] at time zone 'Asia/Kolkata')::time)
  returning id into v_enr;

  for i in 1 .. v_count loop
    insert into public.sessions (enrollment_id, scheduled_at) values (v_enr, p_timestamps[i]);
  end loop;

  return v_enr;
end $fn$;

grant execute on function
  public.book_slots(uuid, uuid, uuid, timestamptz[])
  to authenticated;
