-- KidsConnect — a parent picks several free slots at once (say, Monday 5pm and
-- Thursday 6pm) instead of one weekly slot plus an abstract "4/8/12 classes" count.
-- Each picked slot becomes a real weekly commitment; classes_per_month is now derived
-- (slots picked × 4 weeks), not chosen separately.
--
-- book_slot now creates the actual session rows itself, one per slot per week for four
-- weeks, at booking time rather than at payment time — fund_enrollment still runs
-- (real money, same as ever) but skips its own single-slot generation loop when it
-- finds sessions already there.

drop function if exists public.book_slot(uuid, uuid, uuid, smallint, time, integer);

create or replace function public.book_slot(
  p_child_id    uuid,
  p_trainer_id  uuid,
  p_category_id uuid,
  p_weekdays    smallint[],
  p_times       time[]
) returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  v_rate    numeric(12,2);
  v_enr     uuid;
  v_today   date := (now() at time zone 'Asia/Kolkata')::date;
  v_first   date;
  v_weekday smallint;
  v_time    time;
  v_count   integer := coalesce(array_length(p_weekdays, 1), 0);
  i         integer;
  w         integer;
begin
  if v_count = 0 or v_count <> coalesce(array_length(p_times, 1), 0) then
    raise exception 'Pick at least one slot';
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

  -- Check every requested slot before writing anything — a partially booked package is
  -- worse than refusing the whole request.
  for i in 1 .. v_count loop
    v_weekday := p_weekdays[i];
    v_time    := p_times[i];
    if exists (
      select 1 from public.enrollments
       where trainer_id = p_trainer_id and status = 'active'
         and schedule_weekday = v_weekday and schedule_time = v_time
    ) then
      raise exception 'One of those slots is already taken — pick another one';
    end if;
    if exists (
      select 1 from public.trainer_blocked_slots
       where trainer_id = p_trainer_id and weekday = v_weekday and time = v_time
    ) then
      raise exception 'The coach has marked one of those slots as unavailable — pick another one';
    end if;
  end loop;

  insert into public.enrollments
    (parent_id, child_id, trainer_id, category_id, rate_per_class,
     classes_per_month, schedule_weekday, schedule_time)
  values
    (auth.uid(), p_child_id, p_trainer_id, p_category_id, v_rate,
     v_count * 4, p_weekdays[1], p_times[1])
  returning id into v_enr;

  for i in 1 .. v_count loop
    v_weekday := p_weekdays[i];
    v_time    := p_times[i];
    v_first := v_today + ((v_weekday - extract(dow from v_today)::integer + 7) % 7);
    for w in 0 .. 3 loop
      insert into public.sessions (enrollment_id, scheduled_at)
      values (v_enr, ((v_first + (w * 7)) + v_time) at time zone 'Asia/Kolkata');
    end loop;
  end loop;

  return v_enr;
end $fn$;

grant execute on function
  public.book_slot(uuid, uuid, uuid, smallint[], time[])
  to authenticated;

-- ---------------------------------------------------------------- fund_enrollment

create or replace function public.fund_enrollment(p_enrollment_id uuid)
returns numeric language plpgsql security definer set search_path = public as $fn$
declare
  v_enr    public.enrollments%rowtype;
  v_wallet uuid;
  v_escrow uuid;
  v_total  numeric(12,2);
  v_first  date;
  v_time   time;
  v_today  date := (now() at time zone 'Asia/Kolkata')::date;
  i        integer;
begin
  select * into v_enr from public.enrollments where id = p_enrollment_id for update;
  if not found then raise exception 'Enrollment not found'; end if;
  if v_enr.parent_id <> auth.uid() and not public.is_admin() then
    raise exception 'Only the parent on this enrollment may fund it';
  end if;
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
         start_date = coalesce(start_date, v_today)
   where id = v_enr.id;

  -- book_slot (direct multi-slot booking) already wrote the real sessions at booking
  -- time; only the old single-slot accept_enquiry path still needs them generated here.
  if not exists (select 1 from public.sessions where enrollment_id = v_enr.id) then
    v_time := coalesce(v_enr.schedule_time, time '17:00');

    if v_enr.schedule_weekday is null then
      v_first := v_today;
    else
      v_first := v_today
               + ((v_enr.schedule_weekday - extract(dow from v_today)::integer + 7) % 7);
    end if;

    for i in 0 .. (v_enr.classes_per_month - 1) loop
      insert into public.sessions (enrollment_id, scheduled_at)
      values (v_enr.id, ((v_first + (i * 7)) + v_time) at time zone 'Asia/Kolkata');
    end loop;
  end if;

  return v_total;
end $fn$;
