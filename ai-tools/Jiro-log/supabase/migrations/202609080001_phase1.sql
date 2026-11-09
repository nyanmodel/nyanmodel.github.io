begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(display_name) between 1 and 80),
  role text not null default 'member' check (role in ('member', 'admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
-- SECURITY DEFINER avoids recursive RLS on members. No user-controlled arguments.
create function private.is_member() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.members where user_id = (select auth.uid()) and is_active);
$$;
create function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.members where user_id = (select auth.uid()) and is_active and role = 'admin');
$$;
revoke all on function private.is_member(), private.is_admin() from public;
grant execute on function private.is_member(), private.is_admin() to authenticated;

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 200),
  category text not null default 'jiro' check (category in ('jiro','inspired','other')),
  address text, is_closed boolean not null default false, note text,
  created_by uuid not null default auth.uid() references public.members(user_id),
  created_at timestamptz not null default now()
);
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references public.members(user_id),
  shop_id uuid references public.shops(id) on delete set null,
  visited_at timestamptz not null default now(),
  meal_type text check (meal_type in ('朝食','昼食','ブランチ','夕食','夜食','その他')),
  health smallint check (health between 1 and 5),
  hunger smallint check (hunger between 1 and 5),
  sleep_minutes integer check (sleep_minutes >= 0),
  minutes_since_last_meal integer check (minutes_since_last_meal >= 0),
  pre_meal_note text, exercise_type text,
  exercise_value numeric check (exercise_value >= 0),
  status text not null default 'draft' check (status in ('draft','completed')),
  note text check (length(note) <= 5000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index visits_visited_at_idx on public.visits(visited_at desc);
create index visits_created_by_idx on public.visits(created_by);
create index visits_shop_id_idx on public.visits(shop_id);
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.visits(id) on delete cascade,
  created_by uuid not null default auth.uid() references public.members(user_id),
  storage_path text not null unique,
  width integer check (width > 0), height integer check (height > 0),
  file_size integer check (file_size > 0 and file_size <= 5242880),
  mime_type text check (mime_type in ('image/webp','image/jpeg')),
  captured_at timestamptz, sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  constraint photo_path_matches_ids check (
    storage_path = created_by::text || '/' || visit_id::text || '/' || id::text || '.webp'
    or storage_path = created_by::text || '/' || visit_id::text || '/' || id::text || '.jpg'
  )
);
create index photos_visit_id_idx on public.photos(visit_id);
create index photos_created_by_idx on public.photos(created_by);

-- Ownership and identity cannot be reassigned, including through an admin update.
create function private.protect_record_identity() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.created_by <> old.created_by then raise exception 'Record identity is immutable'; end if;
  new.created_at := old.created_at;
  if tg_table_name = 'photos' then
    if new.visit_id <> old.visit_id or new.storage_path <> old.storage_path then raise exception 'Photo identity is immutable'; end if;
  end if;
  if tg_table_name = 'visits' then new.updated_at := now(); end if;
  return new;
end;
$$;
create trigger visits_identity before update on public.visits for each row execute function private.protect_record_identity();
create trigger photos_identity before update on public.photos for each row execute function private.protect_record_identity();
create trigger shops_identity before update on public.shops for each row execute function private.protect_record_identity();

alter table public.members enable row level security;
alter table public.shops enable row level security;
alter table public.visits enable row level security;
alter table public.photos enable row level security;
revoke all on public.members, public.shops, public.visits, public.photos from anon;
grant select, insert, update, delete on public.members, public.shops, public.visits, public.photos to authenticated;
create policy members_read on public.members for select to authenticated using (private.is_member());
create policy members_create on public.members for insert to authenticated with check (private.is_admin());
create policy members_update on public.members for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy members_delete on public.members for delete to authenticated using (private.is_admin());
create policy shops_read on public.shops for select to authenticated using (private.is_member());
create policy shops_create on public.shops for insert to authenticated with check (private.is_member() and created_by = (select auth.uid()));
create policy shops_update on public.shops for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy shops_delete on public.shops for delete to authenticated using (private.is_admin());
create policy visits_read on public.visits for select to authenticated using (private.is_member());
create policy visits_create on public.visits for insert to authenticated with check (private.is_member() and created_by = (select auth.uid()));
create policy visits_update on public.visits for update to authenticated using (private.is_member() and (created_by = (select auth.uid()) or private.is_admin())) with check (private.is_member() and (created_by = (select auth.uid()) or private.is_admin()));
create policy visits_delete on public.visits for delete to authenticated using (private.is_member() and (created_by = (select auth.uid()) or private.is_admin()));
create policy photos_read on public.photos for select to authenticated using (private.is_member());
create policy photos_create on public.photos for insert to authenticated with check (
  private.is_member() and created_by = (select auth.uid())
  and exists (select 1 from public.visits v where v.id = visit_id and v.created_by = (select auth.uid()))
);
create policy photos_update on public.photos for update to authenticated using (private.is_member() and (created_by = (select auth.uid()) or private.is_admin())) with check (private.is_member() and (created_by = (select auth.uid()) or private.is_admin()));
create policy photos_delete on public.photos for delete to authenticated using (private.is_member() and (created_by = (select auth.uid()) or private.is_admin()));

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('jiro-photos', 'jiro-photos', false, 5242880, array['image/webp','image/jpeg']);
-- Only accept paths for an existing visit belonging to the path's owner.
create function private.can_write_photo(object_name text) returns boolean language sql stable security invoker set search_path = '' as $$
  select private.is_member()
    and array_length(string_to_array(object_name, '/'), 1) = 3
    and split_part(object_name, '/', 3) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$'
    and exists (select 1 from public.visits v
      where v.id::text = split_part(object_name, '/', 2)
        and v.created_by::text = split_part(object_name, '/', 1)
        and (v.created_by = (select auth.uid()) or private.is_admin()));
$$;
revoke all on function private.can_write_photo(text) from public;
grant execute on function private.can_write_photo(text) to authenticated;
create policy jiro_photos_read on storage.objects for select to authenticated using (bucket_id = 'jiro-photos' and private.is_member());
create policy jiro_photos_create on storage.objects for insert to authenticated with check (bucket_id = 'jiro-photos' and private.can_write_photo(name));
create policy jiro_photos_update on storage.objects for update to authenticated using (bucket_id = 'jiro-photos' and private.can_write_photo(name)) with check (bucket_id = 'jiro-photos' and private.can_write_photo(name));
-- Permit cleanup of orphaned objects after a visit has been deleted.
create policy jiro_photos_delete on storage.objects for delete to authenticated using (bucket_id = 'jiro-photos' and private.is_member() and (split_part(name, '/', 1) = (select auth.uid())::text or private.is_admin()));
commit;
