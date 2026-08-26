-- KidsConnect — a parent picks a slot the coach is actually free for, not the other way
-- round.
--
-- Before this, the coach picked a weekly slot at accept time from an unconstrained
-- SlotPicker that knew nothing about their existing classes — nothing stopped them
-- double-booking themselves against a schedule they were relying on memory for. Now the
-- parent chooses from the coach's real availability (computed from active enrollments,
-- see trainerBookedSlots) while writing the enquiry, the RPC refuses a slot that's
-- already taken, and the coach's own accept screen defaults to what the parent asked for
-- instead of guessing.

alter table public.enquiries
  add column if not exists preferred_weekday smallint check (preferred_weekday between 0 and 6),
  add column if not exists preferred_time    time;

drop function if exists public.send_enquiry(uuid, uuid, uuid, text);

create or replace function public.send_enquiry(
  p_child_id          uuid,
  p_trainer_id        uuid,
  p_category_id       uuid,
  p_message           text default null,
  p_preferred_weekday smallint default null,
  p_preferred_time    time default null
) returns uuid language plpgsql security definer set search_path = public as $fn$
declare v_id uuid; v_child text; v_area text; v_cat text; v_dob date;
begin
  if not exists (select 1 from public.children where id = p_child_id and parent_id = auth.uid()) then
    raise exception 'That is not your child';
  end if;
  if not exists (select 1 from public.trainer_categories
                  where trainer_id = p_trainer_id and category_id = p_category_id
                    and status = 'approved') then
    raise exception 'This trainer is not approved in that category';
  end if;
  if exists (select 1 from public.enquiries
              where child_id = p_child_id and trainer_id = p_trainer_id
                and category_id = p_category_id and status = 'open') then
    raise exception 'You already have an open enquiry with this trainer';
  end if;

  -- The one new check: don't let a parent pick a slot the coach is already teaching in.
  -- A second parent racing for the same slot at the same instant still gets caught here
  -- because accept_enquiry re-checks against the real enrollment at accept time.
  if p_preferred_weekday is not null and p_preferred_time is not null
     and exists (
       select 1 from public.enrollments
        where trainer_id = p_trainer_id and status = 'active'
          and schedule_weekday = p_preferred_weekday and schedule_time = p_preferred_time
     ) then
    raise exception 'That slot is already taken — pick another one';
  end if;

  insert into public.enquiries
    (parent_id, child_id, trainer_id, category_id, message, preferred_weekday, preferred_time)
  values (auth.uid(), p_child_id, p_trainer_id, p_category_id, p_message, p_preferred_weekday, p_preferred_time)
  returning id into v_id;

  select name, dob into v_child, v_dob from public.children where id = p_child_id;
  select name into v_cat  from public.categories where id = p_category_id;
  select area_label into v_area from public.profiles where id = auth.uid();

  perform public.enqueue_notification(p_trainer_id, 'enquiry_received',
    jsonb_build_object('enquiry_id', v_id, 'child_name', v_child, 'category_name', v_cat,
                       'area_label', v_area, 'message', p_message,
                       'child_age', case when v_dob is null then null
                                    else extract(year from age(v_dob))::int end));
  return v_id;
end $fn$;

grant execute on function
  public.send_enquiry(uuid, uuid, uuid, text, smallint, time)
  to authenticated;

-- ---------------------------------------------------------------- accept_enquiry

-- Defaults to what the parent asked for instead of today-at-5pm, and refuses to double
-- book the coach even if they (or the demo) explicitly picks a taken slot — belt and
-- braces alongside the check in send_enquiry, since this is the moment the slot is
-- actually locked in.
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
  v_weekday smallint;
  v_time    time;
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

  v_weekday := coalesce(p_weekday, v_enq.preferred_weekday, extract(dow from current_date)::smallint);
  v_time    := coalesce(p_time, v_enq.preferred_time, time '17:00');

  if exists (
    select 1 from public.enrollments
     where trainer_id = v_enq.trainer_id and status = 'active'
       and schedule_weekday = v_weekday and schedule_time = v_time
  ) then
    raise exception 'You already have a class in that slot — pick another one';
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
