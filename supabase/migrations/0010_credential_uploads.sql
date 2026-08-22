-- Real file uploads for a trainer's skill credential (the category-application step),
-- replacing the free-text "link to it" field. PDFs and photos of certificates live in
-- Supabase Storage; `trainer_categories.credential_url` now holds a storage object path
-- (`{trainer_id}/{filename}`) instead of an arbitrary string.
--
-- The bucket is private — a certificate can carry a real name and institution, so it is
-- treated like the identity documents already handled in 0008: visible to the trainer who
-- uploaded it and to admins reviewing the application, nobody else. Admin screens read it
-- through a signed URL generated server-side, never a public path.

insert into storage.buckets (id, name, public)
values ('credentials', 'credentials', false)
on conflict (id) do nothing;

-- Object names are namespaced `{auth.uid()}/...` by the uploading client, and every
-- policy below checks that first path segment — the same convention as a per-user
-- folder, enforced in the database rather than trusted from the client.
create policy credentials_trainer_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'credentials'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy credentials_trainer_read on storage.objects for select to authenticated
  using (
    bucket_id = 'credentials'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

create policy credentials_trainer_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'credentials'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
