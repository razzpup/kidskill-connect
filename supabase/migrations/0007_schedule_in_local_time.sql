-- KidSkill Connect — a class at 10am is at 10am.
--
-- `(date + time)` produces a bare timestamp, and casting that into a timestamptz column
-- interprets it in the database's timezone, which is UTC. So a trainer choosing 10am was
-- storing 10:00Z — half past three in the afternoon in Bangalore. The seeded 17:00
-- classes were worse: half past ten at night.
--
-- Every participant in this product is in one city, so the honest fix is to say so.
-- The chosen time is Bangalore wall-clock, and it is converted at the point it becomes
-- an instant rather than left to whatever the server happens to be set to.

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

  v_time := coalesce(v_enr.schedule_time, time '17:00');

  -- The first class is the next occurrence of the agreed weekday, counting today, so a
  -- trainer paid on the day they teach gets a class today rather than in six days.
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

  return v_total;
end $fn$;
