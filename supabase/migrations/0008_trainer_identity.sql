-- KidSkill Connect — a trainer proves who they are.
--
-- `id_verified` existed as a boolean nobody could ever set. This gives it a process:
-- the trainer submits an identity document during onboarding, an admin looks at it, and
-- only then can that trainer be approved to teach a category.
--
-- ---------------------------------------------------------------- on storing Aadhaar
--
-- We do not. The full number never reaches this database.
--
-- UIDAI restricts storing Aadhaar numbers, the penalties are real, and a hackathon
-- Postgres is a bad home for a national identity number. The browser validates the full
-- number (twelve digits, Verhoeff checksum) and sends only the last four digits, which
-- is the standard masked form printed on Aadhaar letters, plus a link to the document
-- the admin actually looks at.
--
-- That means this is document review, not eKYC. Genuine Aadhaar verification needs a
-- UIDAI-authorised API and a licence. The column names say `id_last4` rather than
-- `aadhaar` so nobody later assumes the full number is in here.

do $do$
begin
  if not exists (select 1 from pg_type where typname = 'identity_kind') then
    create type identity_kind as enum ('aadhaar','pan','passport','driving_licence','voter_id');
  end if;
end $do$;

alter table public.trainer_profiles
  add column if not exists id_type          identity_kind,
  add column if not exists id_last4         text check (id_last4 ~ '^[0-9]{4}$'),
  add column if not exists id_name          text,
  add column if not exists id_document_url  text,
  add column if not exists id_submitted_at  timestamptz,
  add column if not exists id_verified_at   timestamptz,
  add column if not exists id_verified_by   uuid references public.profiles(id),
  add column if not exists id_reject_reason text;

comment on column public.trainer_profiles.id_last4 is
  'Last four digits only. The full identity number is never stored — see 0008.';

-- ---------------------------------------------------------------- submit

create or replace function public.submit_identity(
  p_type         identity_kind,
  p_last4        text,
  p_name_on_id   text,
  p_document_url text default null
) returns void language plpgsql security definer set search_path = public as $fn$
begin
  if p_last4 !~ '^[0-9]{4}$' then
    raise exception 'Send only the last four digits of the number';
  end if;
  if p_name_on_id is null or char_length(btrim(p_name_on_id)) < 2 then
    raise exception 'Enter the name exactly as printed on the document';
  end if;

  update public.trainer_profiles
     set id_type          = p_type,
         id_last4         = p_last4,
         id_name          = btrim(p_name_on_id),
         id_document_url  = p_document_url,
         id_submitted_at  = now(),
         -- Resubmitting after a rejection puts the trainer back in the queue rather
         -- than leaving the old refusal attached to new evidence.
         id_verified      = false,
         id_reject_reason = null
   where user_id = auth.uid();

  if not found then raise exception 'Create your trainer profile first'; end if;
end $fn$;

grant execute on function public.submit_identity(identity_kind, text, text, text) to authenticated;

-- ---------------------------------------------------------------- review

create or replace function public.review_identity(
  p_trainer_id uuid,
  p_approve    boolean,
  p_reason     text default null
) returns void language plpgsql security definer set search_path = public as $fn$
begin
  if not public.is_admin() then raise exception 'Admin role required'; end if;
  if not p_approve and coalesce(btrim(p_reason), '') = '' then
    raise exception 'Give a reason so the trainer knows what to fix';
  end if;

  update public.trainer_profiles
     set id_verified      = p_approve,
         id_verified_at   = case when p_approve then now() end,
         id_verified_by   = case when p_approve then auth.uid() end,
         id_reject_reason = case when p_approve then null else p_reason end
   where user_id = p_trainer_id;

  if not found then raise exception 'No trainer profile with that id'; end if;

  perform public.enqueue_notification(
    p_trainer_id,
    case when p_approve then 'identity_verified' else 'identity_rejected' end,
    jsonb_build_object('reason', p_reason));
end $fn$;

grant execute on function public.review_identity(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------- the gate
--
-- Identity comes before teaching. A credential says someone can teach the subject; an
-- identity document says we know who is turning up at the door. For a product that puts
-- adults in a room with other people's children, the second one cannot be optional, so
-- category approval is blocked until it is done rather than merely discouraged.

create or replace function public.review_trainer_category(
  p_id      uuid,
  p_approve boolean,
  p_reason  text default null
) returns void language plpgsql security definer set search_path = public as $fn$
declare v_trainer uuid; v_cat text; v_id_ok boolean;
begin
  if not public.is_admin() then raise exception 'Admin role required'; end if;

  select tc.trainer_id, tp.id_verified into v_trainer, v_id_ok
    from public.trainer_categories tc
    join public.trainer_profiles tp on tp.user_id = tc.trainer_id
   where tc.id = p_id and tc.status = 'pending';
  if v_trainer is null then raise exception 'No pending application with that id'; end if;

  if p_approve and not coalesce(v_id_ok, false) then
    raise exception 'Verify this trainer''s identity before approving them to teach';
  end if;

  update public.trainer_categories
     set status        = case when p_approve then 'approved' else 'rejected' end::verification_status,
         reviewed_by   = auth.uid(),
         reviewed_at   = now(),
         reject_reason = case when p_approve then null else p_reason end
   where id = p_id;

  select c.name into v_cat
    from public.trainer_categories tc join public.categories c on c.id = tc.category_id
   where tc.id = p_id;

  perform public.enqueue_notification(v_trainer,
    case when p_approve then 'category_approved' else 'category_rejected' end,
    jsonb_build_object('category_name', v_cat, 'reason', p_reason));
end $fn$;
