-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- 1. Profiles table (auto-created on signup)
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  display_name text,
  subscription_status text default 'free' check (subscription_status in ('free', 'active', 'canceled')),
  stripe_customer_id text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Projects table
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  title text not null default 'Untitled',
  active_tab int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Tabs table (5 per project)
create table if not exists tabs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  tab_index int not null check (tab_index >= 0 and tab_index <= 4),
  color text not null,
  content text default '',
  has_content boolean default false,
  unique(project_id, tab_index)
);

-- 4. Row Level Security
alter table profiles enable row level security;
alter table projects enable row level security;
alter table tabs enable row level security;

-- Profiles: users can read/update their own profile
create policy "Users can read own profile" on profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);

-- Projects: users can CRUD their own projects
create policy "Users can read own projects" on projects
  for select using (auth.uid() = user_id);

create policy "Users can insert own projects" on projects
  for insert with check (auth.uid() = user_id);

create policy "Users can update own projects" on projects
  for update using (auth.uid() = user_id);

create policy "Users can delete own projects" on projects
  for delete using (auth.uid() = user_id);

-- Tabs: users can CRUD tabs belonging to their projects
create policy "Users can read own tabs" on tabs
  for select using (
    exists (select 1 from projects where projects.id = tabs.project_id and projects.user_id = auth.uid())
  );

create policy "Users can insert own tabs" on tabs
  for insert with check (
    exists (select 1 from projects where projects.id = tabs.project_id and projects.user_id = auth.uid())
  );

create policy "Users can update own tabs" on tabs
  for update using (
    exists (select 1 from projects where projects.id = tabs.project_id and projects.user_id = auth.uid())
  );

create policy "Users can delete own tabs" on tabs
  for delete using (
    exists (select 1 from projects where projects.id = tabs.project_id and projects.user_id = auth.uid())
  );

-- 5. Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists, then create
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 6. Indexes
create index if not exists idx_projects_user_id on projects(user_id);
create index if not exists idx_tabs_project_id on tabs(project_id);
