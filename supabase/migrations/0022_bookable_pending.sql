-- KidsConnect — DEMO-ONLY, continuing 0021: a discoverable-but-pending coach has to
-- actually be bookable too, or "discoverable" is a dead end. Same rule everywhere a
-- category's approval was the gate: pending is allowed through, rejected is not.

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
   where trainer_id = p_trainer_id and category_id = p_category_id
     and status in ('approved', 'pending');
  if v_rate is null then
    raise exception 'This coach is not set up to teach that category';
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

-- ---------------------------------------------------------------- legacy enquiry path

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
                    and status in ('approved', 'pending')) then
    raise exception 'This coach is not set up to teach that category';
  end if;
  if exists (select 1 from public.enquiries
              where child_id = p_child_id and trainer_id = p_trainer_id
                and category_id = p_category_id and status = 'open') then
    raise exception 'You already have an open enquiry with this trainer';
  end if;

  if p_preferred_weekday is not null and p_preferred_time is not null then
    if exists (
      select 1 from public.enrollments
       where trainer_id = p_trainer_id and status = 'active'
         and schedule_weekday = p_preferred_weekday and schedule_time = p_preferred_time
    ) then
      raise exception 'That slot is already taken — pick another one';
    end if;
    if exists (
      select 1 from public.trainer_blocked_slots
       where trainer_id = p_trainer_id
         and weekday = p_preferred_weekday and time = p_preferred_time
    ) then
      raise exception 'The coach has marked that slot as unavailable — pick another one';
    end if;
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
  if exists (
    select 1 from public.trainer_blocked_slots
     where trainer_id = v_enq.trainer_id and weekday = v_weekday and time = v_time
  ) then
    raise exception 'You marked that slot as unavailable — pick another one';
  end if;

  select rate_per_class into v_rate
    from public.trainer_categories
   where trainer_id  = v_enq.trainer_id
     and category_id = v_enq.category_id
     and status in ('approved', 'pending');
  if v_rate is null then
    raise exception 'You are not set up to teach this category';
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
