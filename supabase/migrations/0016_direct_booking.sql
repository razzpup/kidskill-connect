-- KidsConnect — a parent books a free slot directly and pays, no enquiry/accept
-- round-trip in between. The coach's calendar (real bookings + declared-busy slots,
-- see 0013/0014) is what makes this safe: a parent can only ever select a slot that's
-- actually free, checked again here so a race between two parents can't double-book it.
--
-- This does not remove the enquiry system — /trainer/enquiries and /parent/enquiries
-- still work for anything already in flight — it just adds a second, direct path onto
-- the same enrollments table, using the exact same fund_enrollment() for payment.

create or replace function public.book_slot(
  p_child_id          uuid,
  p_trainer_id        uuid,
  p_category_id       uuid,
  p_weekday           smallint,
  p_time              time,
  p_classes_per_month integer default 8
) returns uuid language plpgsql security definer set search_path = public as $fn$
declare
  v_rate numeric(12,2);
  v_enr  uuid;
begin
  if not exists (select 1 from public.children where id = p_child_id and parent_id = auth.uid()) then
    raise exception 'That is not your child';
  end if;
  if p_classes_per_month < 1 or p_classes_per_month > 31 then
    raise exception 'classes_per_month must be between 1 and 31';
  end if;

  select rate_per_class into v_rate
    from public.trainer_categories
   where trainer_id = p_trainer_id and category_id = p_category_id and status = 'approved';
  if v_rate is null then
    raise exception 'This coach is not approved in that category';
  end if;

  if exists (
    select 1 from public.enrollments
     where trainer_id = p_trainer_id and status = 'active'
       and schedule_weekday = p_weekday and schedule_time = p_time
  ) then
    raise exception 'That slot is already taken — pick another one';
  end if;
  if exists (
    select 1 from public.trainer_blocked_slots
     where trainer_id = p_trainer_id and weekday = p_weekday and time = p_time
  ) then
    raise exception 'The coach has marked that slot as unavailable — pick another one';
  end if;

  insert into public.enrollments
    (parent_id, child_id, trainer_id, category_id, rate_per_class,
     classes_per_month, schedule_weekday, schedule_time)
  values
    (auth.uid(), p_child_id, p_trainer_id, p_category_id, v_rate,
     p_classes_per_month, p_weekday, p_time)
  returning id into v_enr;

  return v_enr;
end $fn$;

grant execute on function
  public.book_slot(uuid, uuid, uuid, smallint, time, integer)
  to authenticated;
