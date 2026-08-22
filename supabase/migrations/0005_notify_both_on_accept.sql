-- KidSkill Connect — acceptance tells both sides, not just the parent.
--
-- 0002 notified only the parent when a trainer accepted. That leaves the trainer with
-- no record of a commitment they just made, and it breaks the moment the product is
-- actually selling: two people agreeing to a class and both being told it is on.
--
-- Escrow still sits between acceptance and scheduling, so the two messages say
-- different things on purpose. The parent's is a call to action — the slot is held,
-- fund it. The trainer's is a confirmation with an honest condition attached: the
-- classes appear once the month is funded, because nothing is scheduled that is not
-- paid for.

create or replace function public.accept_enquiry(
  p_enquiry_id        uuid,
  p_classes_per_month integer default 8
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
    (enquiry_id, parent_id, child_id, trainer_id, category_id, rate_per_class, classes_per_month)
  values
    (v_enq.id, v_enq.parent_id, v_enq.child_id, v_enq.trainer_id, v_enq.category_id,
     v_rate, p_classes_per_month)
  returning id into v_enr;

  select name      into v_child   from public.children   where id = v_enq.child_id;
  select name      into v_cat     from public.categories where id = v_enq.category_id;
  select full_name into v_trainer from public.profiles   where id = v_enq.trainer_id;
  select full_name, area_label into v_parent, v_area
    from public.profiles where id = v_enq.parent_id;

  -- The parent: the slot is held, funding it is the next move.
  perform public.enqueue_notification(
    v_enq.parent_id, 'enquiry_accepted',
    jsonb_build_object('enrollment_id', v_enr, 'child_name', v_child,
                       'category_name', v_cat, 'trainer_name', v_trainer,
                       'amount', v_rate * p_classes_per_month,
                       'classes_per_month', p_classes_per_month));

  -- The trainer: a confirmation of what they just agreed to, and who with.
  perform public.enqueue_notification(
    v_enq.trainer_id, 'booking_confirmed',
    jsonb_build_object('enrollment_id', v_enr, 'child_name', v_child,
                       'category_name', v_cat, 'parent_name', v_parent,
                       'area_label', v_area,
                       'amount', v_rate * p_classes_per_month,
                       'classes_per_month', p_classes_per_month));
  return v_enr;
end $fn$;
