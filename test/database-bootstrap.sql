-- Disposable CI-only stand-in for Supabase-managed auth schema.
-- Never run this on a real Supabase project.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (
  id uuid primary key,
  email text
);
create extension if not exists pgcrypto;
