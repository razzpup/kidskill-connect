-- KidSkill Connect — a resting wallet balance, funded ahead of any specific enrollment.
--
-- `parent_wallet` and the `topup` ledger type already existed — every fund_enrollment
-- call already writes a topup into the wallet and immediately holds the same amount
-- into escrow for that one enrollment, so the wallet's balance nets to zero the instant
-- it's touched. This adds the other half: a top-up with nowhere to go yet, so a parent
-- can fund the wallet ahead of picking a coach. It does not change fund_enrollment or
-- how escrow release works — those still move money only on a verified session.

create or replace function public.topup_wallet(p_amount numeric)
returns numeric language plpgsql security definer set search_path = public as $fn$
declare
  v_wallet uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Top-up amount must be positive';
  end if;

  select id into v_wallet from public.accounts
   where owner_id = auth.uid() and type = 'parent_wallet';
  if v_wallet is null then
    raise exception 'No wallet account for this user';
  end if;

  insert into public.ledger_entries (from_account, to_account, amount, type, memo)
  values (null, v_wallet, p_amount, 'topup', 'Wallet top-up via Razorpay');

  return p_amount;
end $fn$;

grant execute on function public.topup_wallet(numeric) to authenticated;
