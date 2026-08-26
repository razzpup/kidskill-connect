-- KidsConnect — cancelling a class is immediate (it comes off both calendars right
-- away), but the refund itself lands in the parent's wallet 24 hours later, not
-- instantly. cancel_session now records the obligation instead of moving money
-- directly; process_due_refunds() is what actually writes the ledger row, and it's
-- swept lazily — called from parentWalletBalance() — rather than needing a cron job.

create table public.pending_refunds (
  id            uuid primary key default extensions.gen_random_uuid(),
  session_id    uuid not null references public.sessions(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id),
  amount        numeric(12,2) not null,
  reason        text,
  refund_after  timestamptz not null,
  processed_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index pending_refunds_due_idx on public.pending_refunds(refund_after) where processed_at is null;

-- Deny-all by default, same as ledger_entries — nothing writes here except the two
-- security-definer functions below, which run as their owner and bypass this.
alter table public.pending_refunds enable row level security;

-- ---------------------------------------------------------------- cancel

create or replace function public.cancel_session(
  p_session_id uuid,
  p_reason     text default null
) returns numeric language plpgsql security definer set search_path = public as $fn$
declare
  v_sess   public.sessions%rowtype;
  v_enr    public.enrollments%rowtype;
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

  update public.sessions set status = 'cancelled' where id = v_sess.id;

  insert into public.pending_refunds (session_id, enrollment_id, amount, reason, refund_after)
  values (v_sess.id, v_enr.id, v_amount, p_reason, now() + interval '24 hours');

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

-- ---------------------------------------------------------------- sweep

-- Writes the actual ledger row for anything whose 24 hours are up. Global, not scoped
-- to the caller — safe to run from any authenticated request since it only ever moves
-- money that was already promised, on a clock nobody can move themselves.
create or replace function public.process_due_refunds()
returns integer language plpgsql security definer set search_path = public as $fn$
declare
  v_count integer := 0;
  r record;
  v_escrow uuid;
  v_wallet uuid;
begin
  for r in
    select pr.*, e.parent_id
      from public.pending_refunds pr
      join public.enrollments e on e.id = pr.enrollment_id
     where pr.processed_at is null and pr.refund_after <= now()
     for update of pr skip locked
  loop
    select id into v_escrow from public.accounts where owner_id = r.parent_id and type = 'escrow';
    select id into v_wallet from public.accounts where owner_id = r.parent_id and type = 'parent_wallet';

    insert into public.ledger_entries
      (enrollment_id, session_id, from_account, to_account, amount, type, memo)
    values
      (r.enrollment_id, r.session_id, v_escrow, v_wallet, r.amount, 'refund',
       coalesce(r.reason, 'Class cancelled by parent'));

    update public.pending_refunds set processed_at = now() where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $fn$;

grant execute on function public.process_due_refunds() to authenticated;
