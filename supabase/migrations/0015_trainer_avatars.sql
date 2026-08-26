-- KidsConnect — a real profile photo for coaches, uploaded during onboarding.
--
-- Unlike credentials and identity documents, an avatar is meant to be seen by anyone
-- browsing search results, so this bucket is public — no signed URL, just a stable
-- public path. profiles.avatar_url already existed and was already read everywhere
-- (search, trainer detail); nothing wrote to it before this.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy avatars_trainer_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_trainer_update on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_trainer_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
