-- KidSkill Connect — a class has a day and a time.
--
-- Until now `fund_enrollment` generated eight classes a week apart, all at 17:00,
-- starting the day the parent paid. Nobody chose that. It made the ledger work and left
-- the actual arrangement — which afternoon, what time — to happen somewhere off-platform,
-- which is exactly the part a parent and a trainer need agreed before anything is real.
--
-- The trainer proposes the slot at the moment they accept, because they are the one with
-- a timetable to protect, and because acceptance is already the point where they commit.
-- The parent sees the day and time in the acceptance message, before paying.

alter table public.enrollments
  add column if not exists schedule_weekday smallint
    check (schedule_weekday between 0 and 6),
  add column if not exists schedule_time time;

comment on column public.enrollments.schedule_weekday is
  'Day of week for the weekly class, 0 = Sunday, matching extract(dow).';

-- ---------------------------------------------------------------- accept

create or replace function public.accept_enquiry(
  p_enquiry_id        uuid,
  p_classes_per_month integer default 8,
  p_weekday           smallint default null,
  p_time              time default null
) returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  v_enq     public.enquiries%rowtype;
  v_rate    numeric(12,2);
  v_enr     uuid;
  v_child   text;
  v_cat     text;
  v_trainer text;
  v_parent  text;
  v_area    text;
  v_weekday smallint := coalesce(p_weekday, extract(dow from current_date)::smallint);
  v_time    time     := coalesce(p_time, time '17:00');
  v_dayname text;
begin
  select * into v_enq from public.enquiries where id = p_enquiry_id for update;
  if not found then raise exception 'Enquiry not found'; end if;

  if v_enq.trainer_id <> auth.uid() and not public.is_admin() then
    raise exception 'Only the trainer the enquiry was sent to may accept it';
  end if;
  if v_enq.status <> 'open' then
    raise exception 'Enquiry is already %', v_enq.status;
  end if;
  if p_classes_per_month < 1 or p_classes_per_month > 31 then
    raise exception 'classes_per_month must be between 1 and 31';
  end if;

  select rate_per_class into v_rate
    from public.trainer_categories
   where trainer_id  = v_enq.trainer_id
     and category_id = v_enq.category_id
     and status      = 'approved';
  if v_rate is null then
    raise exception 'You are not approved in this category';
  end if;

  update public.enquiries
     set status = 'accepted', responded_at = now()
   where id = v_enq.id;

  insert into public.enrollments
    (enquiry_id, parent_id, child_id, trainer_id, category_id, rate_per_class,
     classes_per_month, schedule_weekday, schedule_time)
  values
    (v_enq.id, v_enq.parent_id, v_enq.child_id, v_enq.trainer_id, v_enq.category_id,
     v_rate, p_classes_per_month, v_weekday, v_time)
  returning id into v_enr;

  select name      into v_child   from public.children   where id = v_enq.child_id;
  select name      into v_cat     from public.categories where id = v_enq.category_id;
  select full_name into v_trainer from public.profiles   where id = v_enq.trainer_id;
  select full_name, area_label into v_parent, v_area
    from public.profiles where id = v_enq.parent_id;

  -- 2001-01-07 was a Sunday, so this turns 0..6 into a day name without a lookup table.
  v_dayname := trim(to_char(date '2001-01-07' + v_weekday, 'Day'));

  perform public.enqueue_notification(
    v_enq.parent_id, 'enquiry_accepted',
    jsonb_build_object('enrollment_id', v_enr, 'child_name', v_child,
                       'category_name', v_cat, 'trainer_name', v_trainer,
                       'amount', v_rate * p_classes_per_month,
                       'classes_per_month', p_classes_per_month,
                       'weekday', v_dayname, 'time', to_char(v_time, 'HH12:MIam')));

  perform public.enqueue_notification(
    v_enq.trainer_id, 'booking_confirmed',
    jsonb_build_object('enrollment_id', v_enr, 'child_name', v_child,
                       'category_name', v_cat, 'parent_name', v_parent,
                       'area_label', v_area,
                       'amount', v_rate * p_classes_per_month,
                       'classes_per_month', p_classes_per_month,
                       'weekday', v_dayname, 'time', to_char(v_time, 'HH12:MIam')));
  return v_enr;
end $fn$;

grant execute on function public.accept_enquiry(uuid, integer, smallint, time) to authenticated;

-- ---------------------------------------------------------------- fund

-- Same money behaviour as before — topup, hold, activate — but the month is laid out on
-- the agreed slot instead of "weekly from whenever you happened to pay".
create or replace function public.fund_enrollment(p_enrollment_id uuid)
returns numeric language plpgsql security definer set search_path = public as $fn$
declare
  v_enr    public.enrollments%rowtype;
  v_wallet uuid;
  v_escrow uuid;
  v_total  numeric(12,2);
  v_first  date;
  v_time   time;
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

  v_time := coalesce(v_enr.schedule_time, time '17:00');

  -- The first class is the next occurrence of the agreed weekday, counting today. A
  -- trainer who accepts and is paid on the same weekday they teach gets a class today,
  -- which is what keeps the demo honest.
  if v_enr.schedule_weekday is null then
    v_first := current_date;
  else
    v_first := current_date
             + ((v_enr.schedule_weekday - extract(dow from current_date)::integer + 7) % 7);
  end if;

  for i in 0 .. (v_enr.classes_per_month - 1) loop
    insert into public.sessions (enrollment_id, scheduled_at)
    values (v_enr.id, (v_first + (i * 7)) + v_time);
  end loop;

  return v_total;
end $fn$;
