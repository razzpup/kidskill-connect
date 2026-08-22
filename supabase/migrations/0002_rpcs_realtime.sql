-- KidSkill Connect — the writes 0001 deliberately left unwritten, plus realtime.
--
-- enrollments, ledger_entries and notifications have no client insert policy.
-- Everything that must create one of those rows lives here, as security definer.

-- ---------------------------------------------------------------- notifications

-- Queued by the RPCs below and by the attendance trigger. The NotificationProvider
-- on the server reads the queue and, for twilio, sends; both providers leave the row.
create or replace function public.enqueue_notification(
  p_recipient uuid,
  p_template  text,
  p_payload   jsonb default '{}'
) returns uuid language plpgsql security definer set search_path = public as $fn$
declare v_id uuid;
begin
  insert into public.notifications (recipient_id, channel, template, payload, status)
  values (p_recipient, 'in_app', p_template, coalesce(p_payload, '{}'::jsonb), 'queued')
  returning id into v_id;
  return v_id;
end $fn$;

revoke execute on function public.enqueue_notification(uuid, text, jsonb) from anon, authenticated;

-- ---------------------------------------------------------------- send_enquiry

-- Parent-initiated only, by construction: the caller is always the parent.
create or replace function public.send_enquiry(
  p_child_id    uuid,
  p_trainer_id  uuid,
  p_category_id uuid,
  p_message     text default null
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

  insert into public.enquiries (parent_id, child_id, trainer_id, category_id, message)
  values (auth.uid(), p_child_id, p_trainer_id, p_category_id, p_message)
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

create or replace function public.withdraw_enquiry(p_enquiry_id uuid)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  update public.enquiries set status = 'withdrawn', responded_at = now()
   where id = p_enquiry_id and parent_id = auth.uid() and status = 'open';
  if not found then raise exception 'No open enquiry of yours with that id'; end if;
end $fn$;

-- ---------------------------------------------------------------- accept_enquiry

-- Flips the enquiry to accepted, copies the rate off the *approved* trainer_categories
-- row, and opens the enrollment in pending_payment. The rate is never passed in by the
-- client — it is read from the approved row, the only place it is authoritative.
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

  perform public.enqueue_notification(
    v_enq.parent_id, 'enquiry_accepted',
    jsonb_build_object('enrollment_id', v_enr, 'child_name', v_child,
                       'category_name', v_cat, 'trainer_name', v_trainer,
                       'amount', v_rate * p_classes_per_month,
                       'classes_per_month', p_classes_per_month));
  return v_enr;
end $fn$;

create or replace function public.decline_enquiry(p_enquiry_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_enq public.enquiries%rowtype; v_cat text;
begin
  select * into v_enq from public.enquiries where id = p_enquiry_id for update;
  if not found then raise exception 'Enquiry not found'; end if;
  if v_enq.trainer_id <> auth.uid() and not public.is_admin() then
    raise exception 'Not your enquiry';
  end if;
  if v_enq.status <> 'open' then raise exception 'Enquiry is already %', v_enq.status; end if;

  update public.enquiries set status = 'declined', responded_at = now() where id = v_enq.id;

  select name into v_cat from public.categories where id = v_enq.category_id;
  perform public.enqueue_notification(v_enq.parent_id, 'enquiry_declined',
    jsonb_build_object('category_name', v_cat, 'reason', p_reason));
end $fn$;

-- ---------------------------------------------------------------- rate editing

-- trainer_categories is admin-updatable only, so approval can never be self-granted.
-- Rate is the one field the trainer owns, so it moves through here.
create or replace function public.set_category_rate(p_trainer_category_id uuid, p_rate numeric)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if p_rate is null or p_rate <= 0 then raise exception 'Rate must be positive'; end if;
  update public.trainer_categories
     set rate_per_class = p_rate
   where id = p_trainer_category_id and trainer_id = auth.uid() and status = 'approved';
  if not found then raise exception 'No approved category of yours with that id'; end if;
end $fn$;

-- ---------------------------------------------------------------- admin review

create or replace function public.review_trainer_category(
  p_id      uuid,
  p_approve boolean,
  p_reason  text default null
) returns void language plpgsql security definer set search_path = public as $fn$
declare v_trainer uuid; v_cat text;
begin
  if not public.is_admin() then raise exception 'Admin role required'; end if;

  update public.trainer_categories
     set status        = case when p_approve then 'approved' else 'rejected' end::verification_status,
         reviewed_by   = auth.uid(),
         reviewed_at   = now(),
         reject_reason = case when p_approve then null else p_reason end
   where id = p_id and status = 'pending'
  returning trainer_id into v_trainer;
  if v_trainer is null then raise exception 'No pending application with that id'; end if;

  select c.name into v_cat
    from public.trainer_categories tc join public.categories c on c.id = tc.category_id
   where tc.id = p_id;

  perform public.enqueue_notification(v_trainer,
    case when p_approve then 'category_approved' else 'category_rejected' end,
    jsonb_build_object('category_name', v_cat, 'reason', p_reason));
end $fn$;

-- ---------------------------------------------------------------- admin refund

-- The escrow remainder goes back to the parent's wallet and the enrollment closes.
-- Money already released against a verified class is never clawed back.
create or replace function public.admin_refund_enrollment(
  p_enrollment_id uuid,
  p_reason        text default null
) returns numeric language plpgsql security definer set search_path = public as $fn$
declare
  v_enr       public.enrollments%rowtype;
  v_remaining numeric(12,2);
  v_wallet    uuid;
  v_escrow    uuid;
begin
  if not public.is_admin() then raise exception 'Admin role required'; end if;

  select * into v_enr from public.enrollments where id = p_enrollment_id for update;
  if not found then raise exception 'Enrollment not found'; end if;

  select coalesce(sum(amount) filter (where type = 'hold'), 0)
       - coalesce(sum(amount) filter (where type in ('release','commission','refund')), 0)
    into v_remaining
    from public.ledger_entries where enrollment_id = v_enr.id;

  if v_remaining > 0 then
    select id into v_escrow from public.accounts where owner_id = v_enr.parent_id and type = 'escrow';
    select id into v_wallet from public.accounts where owner_id = v_enr.parent_id and type = 'parent_wallet';
    insert into public.ledger_entries (enrollment_id, from_account, to_account, amount, type, memo)
    values (v_enr.id, v_escrow, v_wallet, v_remaining, 'refund',
            coalesce(p_reason, 'Refunded by admin'));
  end if;

  update public.enrollments set status = 'cancelled' where id = v_enr.id;
  update public.sessions set status = 'cancelled'
   where enrollment_id = v_enr.id and status = 'scheduled';

  perform public.enqueue_notification(v_enr.parent_id, 'enrollment_refunded',
    jsonb_build_object('amount', v_remaining, 'reason', p_reason));
  return v_remaining;
end $fn$;

-- ---------------------------------------------------------------- attendance notify

-- Separate from release_session_funds on purpose: that trigger is the money rule and
-- must stay small enough to reason about. This one only talks.
create or replace function public.notify_session_attended()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare v_enr public.enrollments%rowtype; v_child text; v_cat text; v_trainer text;
begin
  if new.status is distinct from 'attended' then return new; end if;
  if old.status = 'attended' then return new; end if;

  select * into v_enr from public.enrollments where id = new.enrollment_id;
  select name into v_child from public.children   where id = v_enr.child_id;
  select name into v_cat   from public.categories where id = v_enr.category_id;
  select full_name into v_trainer from public.profiles where id = v_enr.trainer_id;

  perform public.enqueue_notification(v_enr.parent_id, 'class_completed',
    jsonb_build_object('session_id', new.id, 'child_name', v_child, 'category_name', v_cat,
                       'trainer_name', v_trainer, 'skill_rating', new.skill_rating,
                       'assessment_note', new.assessment_note,
                       'amount', v_enr.rate_per_class));
  return new;
end $fn$;

create trigger trg_notify_session_attended
after update of status on public.sessions
for each row execute function public.notify_session_attended();

-- ---------------------------------------------------------------- payment notify

create or replace function public.notify_enrollment_funded()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare v_child text; v_cat text;
begin
  if new.status is distinct from 'active' or old.status = 'active' then return new; end if;
  select name into v_child from public.children   where id = new.child_id;
  select name into v_cat   from public.categories where id = new.category_id;

  perform public.enqueue_notification(new.parent_id, 'payment_confirmed',
    jsonb_build_object('enrollment_id', new.id, 'child_name', v_child, 'category_name', v_cat,
                       'amount', new.rate_per_class * new.classes_per_month,
                       'classes_per_month', new.classes_per_month));
  perform public.enqueue_notification(new.trainer_id, 'enrollment_funded',
    jsonb_build_object('enrollment_id', new.id, 'child_name', v_child, 'category_name', v_cat,
                       'classes_per_month', new.classes_per_month));
  return new;
end $fn$;

create trigger trg_notify_enrollment_funded
after update of status on public.enrollments
for each row execute function public.notify_enrollment_funded();

-- ---------------------------------------------------------------- notification read state

alter table public.notifications add column if not exists read_at timestamptz;

create policy notifications_own_update on public.notifications for update
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- ---------------------------------------------------------------- the spine

-- The parent dashboard's hero. Newest first, across every trainer the child has had.
create or replace function public.child_progress_spine(p_child_id uuid)
returns table (
  session_id      uuid,
  scheduled_at    timestamptz,
  marked_at       timestamptz,
  assessment_note text,
  skill_rating    integer,
  focus_areas     text[],
  category_name   text,
  category_slug   text,
  trainer_id      uuid,
  trainer_name    text,
  trainer_avatar  text
) language sql stable set search_path = public as $fn$
  select s.id, s.scheduled_at, s.attendance_marked_at, s.assessment_note, s.skill_rating,
         s.focus_areas, c.name, c.slug, p.id, p.full_name, p.avatar_url
    from public.sessions s
    join public.enrollments e on e.id = s.enrollment_id
    join public.categories   c on c.id = e.category_id
    join public.profiles     p on p.id = e.trainer_id
   where e.child_id = p_child_id
     and s.status   = 'attended'
   order by coalesce(s.attendance_marked_at, s.scheduled_at) desc;
$fn$;

-- ---------------------------------------------------------------- realtime

-- The demo's central moment. Attendance marked on one device must move the parent's
-- dashboard and the admin monitor on two others, in the same second.
alter table public.sessions       replica identity full;
alter table public.ledger_entries replica identity full;
alter table public.enrollments    replica identity full;
alter table public.enquiries      replica identity full;
alter table public.notifications  replica identity full;

do $do$
begin
  begin alter publication supabase_realtime add table public.sessions;       exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.ledger_entries; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.enrollments;    exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.enquiries;      exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.notifications;  exception when duplicate_object then null; end;
end $do$;

-- ---------------------------------------------------------------- location read

-- PostgREST serialises geography as WKB hex, which is not a useful thing to hand a
-- React component. Location is captured once and read back many times, so it is
-- decoded here rather than in the app.
create or replace function public.my_location()
returns table (lat double precision, lng double precision, area_label text)
language sql stable set search_path = public, extensions as $fn$
  select extensions.ST_Y(location::extensions.geometry),
         extensions.ST_X(location::extensions.geometry),
         area_label
    from public.profiles
   where id = auth.uid() and location is not null;
$fn$;

create or replace function public.trainer_location(p_trainer_id uuid)
returns table (lat double precision, lng double precision)
language sql stable set search_path = public, extensions as $fn$
  select extensions.ST_Y(base_location::extensions.geometry),
         extensions.ST_X(base_location::extensions.geometry)
    from public.trainer_profiles
   where user_id = p_trainer_id;
$fn$;
