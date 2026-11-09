import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
const db = new PGlite();
const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
const admin = '33333333-3333-4333-8333-333333333333';
const inactive = '44444444-4444-4444-8444-444444444444';
const outsider = '55555555-5555-4555-8555-555555555555';
const visit = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const photo = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
async function asUser(id: string, sql: string) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${id}', false);`);
  try { return await db.query(sql); } finally { await db.exec('reset role'); }
}
beforeAll(async () => {
  // Real PostgreSQL RLS engine; mock only Supabase-owned auth and storage schemas.
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid() primary key,bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant usage on schema public,storage to authenticated;
    grant select,insert,update,delete on storage.objects to authenticated;
  `);
  await db.exec(readFileSync(new URL('../supabase/migrations/202609080001_phase1.sql', import.meta.url), 'utf8'));
  await db.exec(`insert into auth.users values ('${alice}'),('${bob}'),('${admin}'),('${inactive}'),('${outsider}');
    insert into public.members(user_id,display_name,role,is_active) values ('${alice}','Alice','member',true),('${bob}','Bob','member',true),('${admin}','Admin','admin',true),('${inactive}','Inactive','member',false);`);
}, 30000);
afterAll(async () => { await db.close(); });
describe('Phase 1 database and storage policies', () => {
  it('allows photo-only drafts and rejects forged ownership', async () => {
    await asUser(alice, `insert into public.visits(id,created_by) values ('${visit}','${alice}')`);
    await expect(asUser(bob, `insert into public.visits(created_by) values ('${alice}')`)).rejects.toThrow(/row-level security/);
    expect((await asUser(bob, 'select * from public.visits')).rows).toHaveLength(1);
  });
  it('denies anonymous, inactive, and unregistered users', async () => {
    for (const id of [inactive, outsider]) {
      expect((await asUser(id, 'select * from public.visits')).rows).toHaveLength(0);
      await expect(asUser(id, `insert into public.visits(created_by) values ('${id}')`)).rejects.toThrow(/row-level security/);
    }
    await db.exec('set role anon');
    await expect(db.query('select * from public.visits')).rejects.toThrow(/permission denied/);
    await db.exec('reset role');
  });
  it('prevents editing or deleting another member’s visit and owner reassignment', async () => {
    expect((await asUser(bob, `update public.visits set note='bad' where id='${visit}' returning id`)).rows).toHaveLength(0);
    expect((await asUser(bob, `delete from public.visits where id='${visit}' returning id`)).rows).toHaveLength(0);
    await expect(asUser(alice, `update public.visits set created_by='${bob}' where id='${visit}'`)).rejects.toThrow(/immutable/);
    expect((await asUser(admin, `update public.visits set note='admin edit' where id='${visit}' returning id`)).rows).toHaveLength(1);
  });
  it('prevents member self-promotion and reactivation', async () => {
    expect((await asUser(alice, `update public.members set role='admin' where user_id='${alice}' returning user_id`)).rows).toHaveLength(0);
    expect((await asUser(inactive, `update public.members set is_active=true where user_id='${inactive}' returning user_id`)).rows).toHaveLength(0);
  });
  it('requires a photo path and parent visit owned by the same member', async () => {
    await asUser(alice, `insert into public.photos(id,visit_id,created_by,storage_path) values ('${photo}','${visit}','${alice}','${alice}/${visit}/${photo}.webp')`);
    await expect(asUser(bob, `insert into public.photos(visit_id,created_by,storage_path) values ('${visit}','${bob}','bad')`)).rejects.toThrow();
    await expect(asUser(alice, `update public.photos set storage_path='bad' where id='${photo}'`)).rejects.toThrow(/immutable/);
  });
  it('enforces private storage reads and owner/admin writes', async () => {
    const path = `${alice}/${visit}/${photo}.webp`;
    await asUser(alice, `insert into storage.objects(bucket_id,name) values ('jiro-photos','${path}')`);
    expect((await asUser(bob, 'select * from storage.objects')).rows).toHaveLength(1);
    expect((await asUser(inactive, 'select * from storage.objects')).rows).toHaveLength(0);
    expect((await asUser(outsider, 'select * from storage.objects')).rows).toHaveLength(0);
    await expect(asUser(bob, `insert into storage.objects(bucket_id,name) values ('jiro-photos','${path}')`)).rejects.toThrow(/row-level security/);
    await expect(asUser(bob, `insert into storage.objects(bucket_id,name) values ('jiro-photos','${bob}/${visit}/${photo}.webp')`)).rejects.toThrow(/row-level security/);
    expect((await asUser(bob, `update storage.objects set name=name returning id`)).rows).toHaveLength(0);
    expect((await asUser(alice, `update storage.objects set name=name returning id`)).rows).toHaveLength(1);
    expect((await asUser(admin, `update storage.objects set name=name returning id`)).rows).toHaveLength(1);
    expect((await db.query("select public from storage.buckets where id='jiro-photos'")).rows).toEqual([{ public: false }]);
  });
});
