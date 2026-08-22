-- KidSkill Connect — fund_enrollment now checks who is calling it.
--
-- `fund_enrollment` is security definer and, until now, never compared the enrollment's
-- parent_id to auth.uid() — the RLS policy on `enrollments` never got a chance to run
-- inside it. `payForEnrollment` didn't check ownership before calling it either, so any
-- authenticated user who knew (or guessed) an enrollment id could fund someone else's
-- escrow. That was low-stakes while the "gateway" was a same-request mock; wiring in a
-- real Razorpay round trip is the moment to close it, the same way accept_enquiry
-- already checks `trainer_id = auth.uid()`.

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
