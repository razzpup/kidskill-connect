-- KidsConnect — a parent cancels one future, unattended class and gets that class's
-- share back in their wallet immediately. This is a per-session refund, not the
-- whole-enrollment one admin_refund_enrollment does — everything else on the
-- enrollment (other scheduled classes, the trainer relationship) is untouched.

create or replace function public.cancel_session(
  p_session_id uuid,
  p_reason     text default null
) returns numeric language plpgsql security definer set search_path = public as $fn$
declare
  v_sess   public.sessions%rowtype;
  v_enr    public.enrollments%rowtype;
  v_escrow uuid;
  v_wallet uuid;
  v_amount numeric(12,2);
  v_child  text;
  v_cat    text;
begin
  select * into v_sess from public.sessions where id = p_session_id for update;
  if not found then raise exception 'Class not found'; end if;
  if v_sess.status <> 'scheduled' then
    raise exception 'Only a scheduled, unattended class can be cancelled';
  end if;
  if v_sess.scheduled_at <= now() then
    raise exception 'That class has already started';
  end if;

  select * into v_enr from public.enrollments where id = v_sess.enrollment_id for update;
  if v_enr.parent_id <> auth.uid() and not public.is_admin() then
    raise exception 'Only the parent on this enrollment may cancel a class';
  end if;

  v_amount := v_enr.rate_per_class;

  select id into v_escrow from public.accounts where owner_id = v_enr.parent_id and type = 'escrow';
  select id into v_wallet from public.accounts where owner_id = v_enr.parent_id and type = 'parent_wallet';

  insert into public.ledger_entries
    (enrollment_id, session_id, from_account, to_account, amount, type, memo)
  values
    (v_enr.id, v_sess.id, v_escrow, v_wallet, v_amount, 'refund',
     coalesce(p_reason, 'Class cancelled by parent'));

  update public.sessions set status = 'cancelled' where id = v_sess.id;

  select name into v_child from public.children where id = v_enr.child_id;
  select name into v_cat   from public.categories where id = v_enr.category_id;

  perform public.enqueue_notification(v_enr.trainer_id, 'session_cancelled',
    jsonb_build_object(
      'session_id', v_sess.id,
      'child_name', v_child,
      'category_name', v_cat,
      'scheduled_at', to_char(v_sess.scheduled_at, 'Dy DD Mon, HH12:MIam'),
      'reason', p_reason
    ));

  return v_amount;
end $fn$;

grant execute on function public.cancel_session(uuid, text) to authenticated;
